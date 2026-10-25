import gleam/string

pub type Outcome {
  Outcome(exit: Int, output: String)
}

@external(erlang, "fleet_ffi", "run_shell")
fn run_shell_ffi(command: String, dir: String, timeout_ms: Int) -> #(Int, String)

pub fn run(command: String, in dir: String, timeout_ms timeout_ms: Int) -> Outcome {
  let #(exit, output) = run_shell_ffi(command, dir, timeout_ms)
  Outcome(exit:, output:)
}

@external(erlang, "fleet_ffi", "now_ms")
pub fn now_ms() -> Int

@external(erlang, "fleet_ffi", "unique")
pub fn unique() -> String

pub fn quote(text: String) -> String {
  "'" <> string.replace(text, "'", "'\\''") <> "'"
}
