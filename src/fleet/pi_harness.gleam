import envoy
import fleet/agent.{type Goal, type Report, Report}
import fleet/shape.{type Shape}
import fleet/shell
import gleam/dynamic/decode
import gleam/json
import gleam/result
import simplifile

pub type PiReceipt {
  PiReceipt(
    outcome: String,
    note: String,
    turns: Int,
    tool_calls: Int,
    mcp_calls: Int,
    scope_denials: Int,
    tests_run: Int,
    tokens_in: Int,
    tokens_out: Int,
    usd: Float,
    ms: Int,
    session_id: String,
    resumed: Bool,
  )
}

pub fn run(
  id: String,
  the_shape: Shape,
  shape_file: String,
  goal: Goal,
  prompt_file: String,
) -> #(Report, Result(PiReceipt, String)) {
  let seat_dir = goal.scope.root <> "/../" <> id <> ".pi"
  let _ = simplifile.create_directory_all(seat_dir)
  let spec_file = seat_dir <> "/seat-shape.json"
  let receipt_file = seat_dir <> "/receipt.json"
  let spec = seat_spec(id, shape_file, goal)
  let _ = simplifile.write(spec_file, spec)
  let command =
    "node "
    <> shell.quote(runner())
    <> " "
    <> shell.quote(goal.scope.root)
    <> " "
    <> shell.quote(spec_file)
    <> " "
    <> shell.quote(prompt_file)
    <> " "
    <> shell.quote(receipt_file)
  let ran = shell.run(command, in: goal.scope.root, timeout_ms: 1_800_000)
  let receipt = case ran.exit {
    0 -> read_receipt(receipt_file)
    _ -> Error("pi runner exit " <> ran.output)
  }
  #(to_report(id, the_shape, goal, receipt), receipt)
}

fn runner() -> String {
  envoy.get("FLEET_ROOT")
  |> result.unwrap(".")
  |> fn(root) { root <> "/harness/pi/run-seat.mjs" }
}

fn seat_spec(id: String, shape_file: String, goal: Goal) -> String {
  let base = simplifile.read(shape_file) |> result.unwrap("{}")
  let extra =
    json.object([
      #("seat_id", json.string(id)),
      #("writable", json.array(goal.scope.writable, json.string)),
    ])
    |> json.to_string
  merge_json(base, extra)
}

@external(erlang, "fleet_json_ffi", "merge_objects")
fn merge_json(base: String, extra: String) -> String

fn read_receipt(path: String) -> Result(PiReceipt, String) {
  use text <- result.try(
    simplifile.read(path) |> result.replace_error("no receipt " <> path),
  )
  json.parse(text, receipt_decoder()) |> result.replace_error("bad receipt")
}

fn receipt_decoder() -> decode.Decoder(PiReceipt) {
  use outcome <- decode.field("outcome", decode.string)
  use note <- decode.field("note", decode.string)
  use turns <- decode.field("turns", decode.int)
  use tool_calls <- decode.field("tool_calls", decode.int)
  use mcp_calls <- decode.field("mcp_calls", decode.int)
  use scope_denials <- decode.field("scope_denials", decode.int)
  use tests_run <- decode.field("tests_run", decode.int)
  use tokens_in <- decode.field("tokens_in", decode.int)
  use tokens_out <- decode.field("tokens_out", decode.int)
  use usd <- decode.field("usd", number())
  use ms <- decode.field("ms", decode.int)
  use session_id <- decode.field("session_id", decode.string)
  use resumed <- decode.field("resumed", decode.bool)
  decode.success(PiReceipt(
    outcome:,
    note:,
    turns:,
    tool_calls:,
    mcp_calls:,
    scope_denials:,
    tests_run:,
    tokens_in:,
    tokens_out:,
    usd:,
    ms:,
    session_id:,
    resumed:,
  ))
}

fn number() -> decode.Decoder(Float) {
  decode.one_of(decode.float, [decode.int |> decode.map(int_to_float)])
}

@external(erlang, "erlang", "float")
fn int_to_float(value: Int) -> Float

fn to_report(
  id: String,
  the_shape: Shape,
  goal: Goal,
  receipt: Result(PiReceipt, String),
) -> Report {
  case receipt {
    Ok(r) ->
      Report(
        agent: id,
        shape: the_shape.name,
        goal: goal.id,
        outcome: outcome_of(r),
        turns: r.turns,
        tool_calls: r.tool_calls,
        scope_denials: r.scope_denials,
        tests_run: r.tests_run,
        tokens_in: r.tokens_in,
        tokens_out: r.tokens_out,
        ms: r.ms,
      )
    Error(reason) ->
      Report(
        agent: id,
        shape: the_shape.name,
        goal: goal.id,
        outcome: agent.ModelError(reason),
        turns: 0,
        tool_calls: 0,
        scope_denials: 0,
        tests_run: 0,
        tokens_in: 0,
        tokens_out: 0,
        ms: 0,
      )
  }
}

fn outcome_of(r: PiReceipt) -> agent.Outcome {
  case r.outcome {
    "done" -> agent.Done(r.note)
    "ran_out_of_tokens" -> agent.RanOutOfTokens
    "killed" -> agent.OutOfTurns
    "harness_error" -> agent.ModelError(r.note)
    _ -> agent.StoppedTalking(r.note)
  }
}
