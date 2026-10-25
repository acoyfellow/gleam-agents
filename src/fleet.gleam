import argv
import envoy
import fleet/pi_harness
import fleet/agent.{type Report}
import fleet/llm
import fleet/plan.{type Plan, type Seat}
import fleet/scope
import fleet/shape
import fleet/shell
import gleam/erlang/process.{type Subject}
import gleam/float
import gleam/int
import gleam/io
import gleam/json
import gleam/list
import gleam/result
import gleam/string
import simplifile

pub type Graded {
  Graded(
    seat: Seat,
    report: Report,
    visible_exit: Int,
    grade_exit: Int,
    usd: Float,
    workspace: String,
  )
}

pub fn main() -> Nil {
  case argv.load().arguments {
    ["run", plan_path, out_dir] -> exit_with(run(plan_path, out_dir))
    _ -> {
      io.println("usage: gleam run -- run <plan.json> <out_dir>")
      exit_with(Error("bad arguments"))
    }
  }
}

fn exit_with(result: Result(Nil, String)) -> Nil {
  case result {
    Ok(_) -> Nil
    Error(reason) -> {
      io.println_error("fleet: " <> reason)
      halt(1)
    }
  }
}

@external(erlang, "erlang", "halt")
fn halt(code: Int) -> Nil

pub fn run(plan_path: String, out_dir: String) -> Result(Nil, String) {
  use the_plan <- result.try(plan.load(plan_path))
  use endpoint <- result.try(llm.endpoint_from_env())
  use base <- result.try(absolute(parent(plan_path)))
  use out_dir <- result.try(make_absolute(out_dir))
  let _ = simplifile.create_directory_all(out_dir <> "/items")
  let inbox = process.new_subject()
  let started = shell.now_ms()
  list.each(the_plan.seats, fn(seat) {
    process.spawn(fn() {
      process.send(inbox, seat_run(seat, base, out_dir, endpoint))
    })
  })
  let results = list.map(the_plan.seats, fn(_) { receive(inbox) })
  let wall = shell.now_ms() - started
  list.each(results, fn(r) {
    case r {
      Ok(graded) ->
        simplifile.write(
          out_dir <> "/items/" <> graded.seat.id <> ".json",
          json.to_string(graded_json(graded)),
        )
      Error(_) -> Ok(Nil)
    }
  })
  let summary = summary_json(the_plan, results, wall)
  let _ = simplifile.write(out_dir <> "/run.json", json.to_string(summary))
  io.println(json.to_string(summary))
  Ok(Nil)
}

fn receive(inbox: Subject(Result(Graded, String))) -> Result(Graded, String) {
  process.receive(inbox, 1_800_000)
  |> result.unwrap(Error("seat timed out"))
}

fn seat_run(
  seat: Seat,
  base: String,
  out_dir: String,
  endpoint: llm.Endpoint,
) -> Result(Graded, String) {
  use the_shape <- result.try(shape.load(catalog_dir(), seat.shape))
  use prompt <- result.try(
    simplifile.read(base <> "/" <> seat.prompt_file)
    |> result.replace_error("no prompt " <> seat.prompt_file),
  )
  let workspace = out_dir <> "/work/" <> seat.id
  let _ = simplifile.create_directory_all(workspace)
  let copied =
    shell.run(
      "rsync -a --exclude node_modules "
        <> shell.quote(base <> "/" <> seat.seed <> "/")
        <> " "
        <> shell.quote(workspace <> "/"),
      in: ".",
      timeout_ms: 60_000,
    )
  use _ <- result.try(case copied.exit {
    0 -> Ok(Nil)
    _ -> Error(seat.id <> ": seed copy failed: " <> copied.output)
  })
  let goal =
    agent.Goal(
      id: seat.goal,
      prompt:,
      scope: scope.Scope(root: workspace, writable: seat.writable),
      test_command: seat.test_command,
    )
  let shape_file = catalog_dir() <> "/" <> seat.shape <> ".json"
  let report = case the_shape.harness {
    "pi" ->
      pi_harness.run(
        seat.id,
        the_shape,
        shape_file,
        goal,
        base <> "/" <> seat.prompt_file,
      ).0
    _ -> agent.run(seat.id, the_shape, goal, endpoint)
  }
  let visible = shell.run(seat.test_command, in: workspace, timeout_ms: 120_000)
  let graded =
    shell.run(seat.grade_command, in: workspace, timeout_ms: 900_000)
  let _ =
    simplifile.write(
      out_dir <> "/items/" <> seat.id <> ".grade.txt",
      graded.output,
    )
  let usd =
    int.to_float(report.tokens_in)
    *. the_shape.price_in
    /. 1_000_000.0
    +. int.to_float(report.tokens_out)
    *. the_shape.price_out
    /. 1_000_000.0
  Ok(Graded(seat, report, visible.exit, graded.exit, usd, workspace))
}

fn outcome_name(outcome: agent.Outcome) -> String {
  case outcome {
    agent.Done(_) -> "done"
    agent.OutOfTurns -> "out_of_turns"
    agent.StoppedTalking(_) -> "stopped_talking"
    agent.ModelError(_) -> "model_error"
    agent.RanOutOfTokens -> "ran_out_of_tokens"
  }
}

fn outcome_note(outcome: agent.Outcome) -> String {
  case outcome {
    agent.Done(s) -> s
    agent.StoppedTalking(t) -> t
    agent.ModelError(r) -> r
    _ -> ""
  }
}

fn graded_json(g: Graded) -> json.Json {
  let r = g.report
  json.object([
    #("seat", json.string(g.seat.id)),
    #("shape", json.string(r.shape)),
    #("goal", json.string(r.goal)),
    #("outcome", json.string(outcome_name(r.outcome))),
    #("note", json.string(string.slice(outcome_note(r.outcome), 0, 300))),
    #("turns", json.int(r.turns)),
    #("tool_calls", json.int(r.tool_calls)),
    #("scope_denials", json.int(r.scope_denials)),
    #("tests_run", json.int(r.tests_run)),
    #("tokens_in", json.int(r.tokens_in)),
    #("tokens_out", json.int(r.tokens_out)),
    #("usd", json.float(float.to_precision(g.usd, 4))),
    #("ms", json.int(r.ms)),
    #("visible_pass", json.bool(g.visible_exit == 0)),
    #("graded_pass", json.bool(g.grade_exit == 0)),
    #("grade_command", json.string(g.seat.grade_command)),
    #("workspace", json.string(g.workspace)),
  ])
}

fn summary_json(
  p: Plan,
  results: List(Result(Graded, String)),
  wall: Int,
) -> json.Json {
  let graded = list.filter_map(results, fn(r) { r })
  let errors =
    list.filter_map(results, fn(r) {
      case r {
        Error(e) -> Ok(e)
        Ok(_) -> Error(Nil)
      }
    })
  let passed = list.count(graded, fn(g) { g.grade_exit == 0 })
  let usd = list.fold(graded, 0.0, fn(acc, g) { acc +. g.usd })
  json.object([
    #("plan", json.string(p.name)),
    #("baseline", json.string(p.baseline)),
    #("seats", json.int(list.length(p.seats))),
    #("graded", json.int(list.length(graded))),
    #("passed", json.int(passed)),
    #("usd", json.float(float.to_precision(usd, 4))),
    #("wall_ms", json.int(wall)),
    #("errors", json.array(errors, json.string)),
  ])
}

fn catalog_dir() -> String {
  envoy.get("FLEET_CATALOG") |> result.unwrap("catalog")
}

fn absolute(path: String) -> Result(String, String) {
  simplifile.resolve(path) |> result.replace_error("cannot resolve " <> path)
}

fn make_absolute(path: String) -> Result(String, String) {
  let _ = simplifile.create_directory_all(path)
  absolute(path)
}

fn parent(path: String) -> String {
  case string.split(path, "/") |> list.reverse {
    [_, ..rest] ->
      case rest {
        [] -> "."
        _ -> rest |> list.reverse |> string.join("/")
      }
    [] -> "."
  }
}
