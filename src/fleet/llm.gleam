import envoy
import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json.{type Json}
import gleam/list
import gleam/result
import gleam/string
import simplifile

pub type Block {
  Text(text: String)
  ToolUse(id: String, name: String, input: decode.Dynamic)
}

pub type Reply {
  Reply(blocks: List(Block), stop: String, tokens_in: Int, tokens_out: Int)
}

pub type Tool {
  Tool(name: String, description: String, schema: Json)
}

pub type Endpoint {
  Endpoint(url: String, headers: List(#(String, String)))
}

const anthropic_url = "https://api.anthropic.com/v1/messages"

pub fn endpoint_from_env() -> Result(Endpoint, String) {
  let base = [#("anthropic-version", "2023-06-01")]
  case envoy.get("LLM_URL"), envoy.get("ANTHROPIC_API_KEY") {
    Ok(url), _ -> Ok(Endpoint(url, list.append(base, gateway_headers())))
    Error(_), Ok(key) -> Ok(Endpoint(anthropic_url, [#("x-api-key", key), ..base]))
    Error(_), Error(_) -> Error("set ANTHROPIC_API_KEY, or LLM_URL with LLM_TOKEN_FILE")
  }
}

fn gateway_headers() -> List(#(String, String)) {
  case envoy.get("LLM_TOKEN_FILE") {
    Error(_) -> []
    Ok(path) ->
      case simplifile.read(path) {
        Error(_) -> []
        Ok(text) -> [
          #("cf-access-token", token_line(text)),
          #("x-requested-with", "xmlhttprequest"),
        ]
      }
  }
}

fn token_line(text: String) -> String {
  text
  |> string.split("\n")
  |> list.find_map(fn(line) {
    case string.split_once(line, "=") {
      Ok(#(_, value)) -> Ok(string.trim(value))
      Error(_) -> Error(Nil)
    }
  })
  |> result.unwrap(string.trim(text))
}

pub fn chat(
  endpoint: Endpoint,
  model: String,
  system: String,
  messages: List(Json),
  tools: List(Tool),
  max_tokens: Int,
) -> Result(Reply, String) {
  let body =
    json.object([
      #("model", json.string(model)),
      #("max_tokens", json.int(max_tokens)),
      #("system", json.string(system)),
      #("messages", json.preprocessed_array(messages)),
      #("tools", json.array(tools, tool_json)),
    ])
    |> json.to_string
  use base <- result.try(
    request.to(endpoint.url) |> result.replace_error("bad LLM url"),
  )
  let req =
    list.fold(
      endpoint.headers,
      base
        |> request.set_method(http.Post)
        |> request.set_header("content-type", "application/json")
        |> request.set_body(body),
      fn(r, h) { request.set_header(r, h.0, h.1) },
    )
  let config = httpc.configure() |> httpc.timeout(180_000)
  use response <- result.try(
    httpc.dispatch(config, req)
    |> result.map_error(fn(e) { "model transport: " <> string.inspect(e) }),
  )
  case response.status {
    200 ->
      json.parse(response.body, reply_decoder())
      |> result.map_error(fn(_) {
        "model reply did not parse: " <> string.slice(response.body, 0, 200)
      })
    status ->
      Error(
        "model "
        <> string.inspect(status)
        <> ": "
        <> string.slice(response.body, 0, 200),
      )
  }
}

fn tool_json(tool: Tool) -> Json {
  json.object([
    #("name", json.string(tool.name)),
    #("description", json.string(tool.description)),
    #("input_schema", tool.schema),
  ])
}

fn reply_decoder() -> decode.Decoder(Reply) {
  use blocks <- decode.field("content", decode.list(block_decoder()))
  use stop <- decode.optional_field("stop_reason", "", decode.string)
  use tokens_in <- decode.subfield(["usage", "input_tokens"], decode.int)
  use tokens_out <- decode.subfield(["usage", "output_tokens"], decode.int)
  decode.success(Reply(blocks:, stop:, tokens_in:, tokens_out:))
}

fn block_decoder() -> decode.Decoder(Block) {
  use kind <- decode.field("type", decode.string)
  case kind {
    "tool_use" -> {
      use id <- decode.field("id", decode.string)
      use name <- decode.field("name", decode.string)
      use input <- decode.field("input", decode.dynamic)
      decode.success(ToolUse(id:, name:, input:))
    }
    "text" -> {
      use text <- decode.field("text", decode.string)
      decode.success(Text(text))
    }
    _ -> decode.success(Text(""))
  }
}

pub fn block_json(block: Block) -> Json {
  case block {
    Text(text) ->
      json.object([#("type", json.string("text")), #("text", json.string(text))])
    ToolUse(id, name, input) ->
      json.object([
        #("type", json.string("tool_use")),
        #("id", json.string(id)),
        #("name", json.string(name)),
        #("input", dynamic_json(input)),
      ])
  }
}

@external(erlang, "fleet_json_ffi", "dynamic_to_json")
fn dynamic_json(value: decode.Dynamic) -> Json
