import fleet/llm.{type Block, type Endpoint, Text, ToolUse}
import fleet/scope.{type Scope}
import fleet/shape.{type Shape}
import fleet/shell
import gleam/dynamic/decode
import gleam/int
import gleam/json.{type Json}
import gleam/list
import gleam/result
import gleam/string
import simplifile

pub type Goal {
  Goal(id: String, prompt: String, scope: Scope, test_command: String)
}

pub type Outcome {
  Done(summary: String)
  OutOfTurns
  StoppedTalking(text: String)
  ModelError(reason: String)
  RanOutOfTokens
}

pub type Report {
  Report(
    agent: String,
    shape: String,
    goal: String,
    outcome: Outcome,
    turns: Int,
    tool_calls: Int,
    scope_denials: Int,
    tests_run: Int,
    tokens_in: Int,
    tokens_out: Int,
    ms: Int,
  )
}

type State {
  State(
    goal: Goal,
    shape: Shape,
    endpoint: Endpoint,
    turns: Int,
    tool_calls: Int,
    scope_denials: Int,
    tests_run: Int,
    tokens_in: Int,
    tokens_out: Int,
    started: Int,
  )
}

const max_output = 6000

pub fn run(id: String, shape: Shape, goal: Goal, endpoint: Endpoint) -> Report {
  let state =
    State(goal, shape, endpoint, 0, 0, 0, 0, 0, 0, shell.now_ms())
  let first =
    json.object([
      #("role", json.string("user")),
      #("content", json.string("Do the task. Start by looking at the repository.")),
    ])
  loop([first], state)
  |> report(id)
}

fn report(pair: #(Outcome, State), id: String) -> Report {
  let #(outcome, s) = pair
  Report(
    agent: id,
    shape: s.shape.name,
    goal: s.goal.id,
    outcome:,
    turns: s.turns,
    tool_calls: s.tool_calls,
    scope_denials: s.scope_denials,
    tests_run: s.tests_run,
    tokens_in: s.tokens_in,
    tokens_out: s.tokens_out,
    ms: shell.now_ms() - s.started,
  )
}

fn loop(messages: List(Json), s: State) -> #(Outcome, State) {
  case s.turns >= s.shape.max_turns {
    True -> #(OutOfTurns, s)
    False -> step(messages, s)
  }
}

fn step(messages: List(Json), s: State) -> #(Outcome, State) {
  case
    llm.chat(
      s.endpoint,
      s.shape.model,
      system_prompt(s.goal),
      messages,
      tools(s.shape),
      s.shape.max_tokens,
    )
  {
    Error(reason) -> #(ModelError(reason), s)
    Ok(reply) -> {
      let s =
        State(
          ..s,
          turns: s.turns + 1,
          tokens_in: s.tokens_in + reply.tokens_in,
          tokens_out: s.tokens_out + reply.tokens_out,
        )
      let calls =
        list.filter(reply.blocks, fn(b) {
          case b {
            ToolUse(..) -> True
            _ -> False
          }
        })
      case calls, reply.stop {
        [], "max_tokens" -> #(RanOutOfTokens, s)
        [], _ -> #(StoppedTalking(text_of(reply.blocks)), s)
        _, _ ->
          case find_done(calls) {
            Ok(summary) -> #(Done(summary), s)
            Error(_) -> {
              let #(s, results) = list.map_fold(calls, s, call_tool)
              let assistant =
                json.object([
                  #("role", json.string("assistant")),
                  #("content", json.array(sendable(reply.blocks), llm.block_json)),
                ])
              let user =
                json.object([
                  #("role", json.string("user")),
                  #("content", json.preprocessed_array(results)),
                ])
              loop(list.append(messages, [assistant, user]), s)
            }
          }
      }
    }
  }
}

fn sendable(blocks: List(Block)) -> List(Block) {
  list.filter(blocks, fn(b) {
    case b {
      Text(t) -> string.trim(t) != ""
      _ -> True
    }
  })
}

fn find_done(calls: List(Block)) -> Result(String, Nil) {
  list.find_map(calls, fn(b) {
    case b {
      ToolUse(_, "done", input) -> Ok(field(input, "summary") |> result.unwrap(""))
      _ -> Error(Nil)
    }
  })
}

fn text_of(blocks: List(Block)) -> String {
  blocks
  |> list.filter_map(fn(b) {
    case b {
      Text(t) -> Ok(t)
      _ -> Error(Nil)
    }
  })
  |> string.join(" ")
  |> string.slice(0, 300)
}

fn call_tool(s: State, block: Block) -> #(State, Json) {
  let assert ToolUse(id, name, input) = block
  let s = State(..s, tool_calls: s.tool_calls + 1)
  let #(s, output) = case list.contains(s.shape.tools, name) {
    False -> #(s, "error: tool " <> name <> " is not available to this agent")
    True -> tool(s, name, input)
  }
  #(
    s,
    json.object([
      #("type", json.string("tool_result")),
      #("tool_use_id", json.string(id)),
      #("content", json.string(clip(output))),
    ]),
  )
}

fn tool(s: State, name: String, input: decode.Dynamic) -> #(State, String) {
  let root = s.goal.scope.root
  case name {
    "list_files" -> #(s, list_files(root))
    "read_file" -> {
      let path = field(input, "path") |> result.unwrap("")
      case scope.resolve(s.goal.scope, path) {
        Error(denied) -> #(denied_state(s), scope.describe(denied))
        Ok(full) -> #(
          s,
          simplifile.read(full)
            |> result.unwrap("error: cannot read " <> path),
        )
      }
    }
    "write_file" -> {
      let path = field(input, "path") |> result.unwrap("")
      let content = field(input, "content") |> result.unwrap("")
      case scope.writable(s.goal.scope, path) {
        Error(denied) -> #(denied_state(s), scope.describe(denied))
        Ok(full) -> {
          let _ = simplifile.create_directory_all(parent(full))
          case simplifile.write(full, content) {
            Ok(_) -> #(
              s,
              "wrote " <> int.to_string(string.byte_size(content)) <> " bytes to " <> path,
            )
            Error(_) -> #(s, "error: cannot write " <> path)
          }
        }
      }
    }
    "edit_file" -> edit(s, input)
    "grep" -> {
      let pattern = field(input, "pattern") |> result.unwrap("")
      let out =
        shell.run(
          "grep -rnE --exclude-dir=node_modules -e " <> shell.quote(pattern) <> " . | head -80",
          in: root,
          timeout_ms: 10_000,
        )
      #(s, case out.output {
        "" -> "no matches"
        text -> text
      })
    }
    "run_tests" -> {
      let out = shell.run(s.goal.test_command, in: root, timeout_ms: 60_000)
      #(
        State(..s, tests_run: s.tests_run + 1),
        "exit " <> int.to_string(out.exit) <> "\n" <> tail(out.output),
      )
    }
    _ -> #(s, "error: unknown tool " <> name)
  }
}

fn edit(s: State, input: decode.Dynamic) -> #(State, String) {
  let path = field(input, "path") |> result.unwrap("")
  let old = field(input, "old") |> result.unwrap("")
  let new = field(input, "new") |> result.unwrap("")
  case scope.writable(s.goal.scope, path) {
    Error(denied) -> #(denied_state(s), scope.describe(denied))
    Ok(full) ->
      case simplifile.read(full) {
        Error(_) -> #(s, "error: cannot read " <> path)
        Ok(text) ->
          case list.length(string.split(text, old)) - 1 {
            1 -> {
              let _ = simplifile.write(full, string.replace(text, old, new))
              #(s, "edited " <> path)
            }
            0 -> #(s, "error: the old text was not found in " <> path)
            n -> #(
              s,
              "error: the old text appears "
                <> int.to_string(n)
                <> " times in "
                <> path
                <> "; give a longer unique snippet",
            )
          }
      }
  }
}

fn denied_state(s: State) -> State {
  State(..s, scope_denials: s.scope_denials + 1)
}

fn list_files(root: String) -> String {
  shell.run(
    "find . -type f -not -path './node_modules/*' -not -path './.git/*' | sed 's#^./##' | sort",
    in: root,
    timeout_ms: 10_000,
  ).output
}

@external(erlang, "fleet_json_ffi", "get_string")
fn field(input: decode.Dynamic, key: String) -> Result(String, Nil)

fn parent(path: String) -> String {
  case string.split(path, "/") |> list.reverse {
    [_, ..rest] -> rest |> list.reverse |> string.join("/")
    [] -> path
  }
}

fn clip(text: String) -> String {
  case string.byte_size(text) > max_output {
    True -> string.slice(text, 0, max_output) <> "\n…(cut)"
    False -> text
  }
}

fn tail(text: String) -> String {
  let n = string.length(text)
  case n > 4000 {
    True -> "…" <> string.slice(text, n - 4000, 4000)
    False -> text
  }
}

fn system_prompt(goal: Goal) -> String {
  "You are a coding agent working in a repository. Your goal:\n\n"
  <> goal.prompt
  <> "\n\nYou may only write these paths: "
  <> string.join(goal.scope.writable, ", ")
  <> ". Writes elsewhere are refused."
  <> "\nUse the tools. Run the tests before you finish. Call done with a one-line summary when the work is complete and the tests pass."
}

fn tools(shape: Shape) -> List(llm.Tool) {
  all_tools() |> list.filter(fn(t) { list.contains(shape.tools, t.name) })
}

fn all_tools() -> List(llm.Tool) {
  let obj = fn(props: List(#(String, Json)), required: List(String)) {
    json.object([
      #("type", json.string("object")),
      #("properties", json.object(props)),
      #("required", json.array(required, json.string)),
    ])
  }
  let str = json.object([#("type", json.string("string"))])
  [
    llm.Tool("list_files", "List every file in the repository, one path per line.", obj([], [])),
    llm.Tool("read_file", "Read one file. Path is relative to the repository root.", obj([#("path", str)], ["path"])),
    llm.Tool("write_file", "Create or overwrite one file with the full content given.", obj([#("path", str), #("content", str)], ["path", "content"])),
    llm.Tool("edit_file", "Replace one exact, unique snippet in a file with new text.", obj([#("path", str), #("old", str), #("new", str)], ["path", "old", "new"])),
    llm.Tool("grep", "Find lines matching an extended regular expression. Returns path:line:text.", obj([#("pattern", str)], ["pattern"])),
    llm.Tool("run_tests", "Run the project's test suite and return its output and exit code.", obj([], [])),
    llm.Tool("done", "Finish. Call this once the work is complete and the tests pass.", obj([#("summary", str)], ["summary"])),
  ]
}
