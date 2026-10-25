import gleam/list
import gleam/string

pub type Scope {
  Scope(root: String, writable: List(String))
}

pub type Denied {
  Escapes(path: String)
  NotWritable(path: String, writable: List(String))
}

pub fn resolve(scope: Scope, path: String) -> Result(String, Denied) {
  let parts = string.split(path, "/")
  let escapes =
    string.starts_with(path, "/")
    || list.any(parts, fn(part) { part == ".." })
    || path == ""
  case escapes {
    True -> Error(Escapes(path))
    False -> Ok(scope.root <> "/" <> path)
  }
}

pub fn writable(scope: Scope, path: String) -> Result(String, Denied) {
  case resolve(scope, path) {
    Error(denied) -> Error(denied)
    Ok(full) ->
      case list.any(scope.writable, fn(prefix) { matches(prefix, path) }) {
        True -> Ok(full)
        False -> Error(NotWritable(path, scope.writable))
      }
  }
}

fn matches(prefix: String, path: String) -> Bool {
  case string.ends_with(prefix, "/") {
    True -> string.starts_with(path, prefix)
    False -> path == prefix
  }
}

pub fn describe(denied: Denied) -> String {
  case denied {
    Escapes(path) -> "error: " <> path <> " is outside the workspace"
    NotWritable(path, writable) ->
      "error: "
      <> path
      <> " is outside this agent's write scope. Writable: "
      <> string.join(writable, ", ")
  }
}
