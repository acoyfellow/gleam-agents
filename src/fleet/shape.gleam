import gleam/dynamic/decode
import gleam/json
import gleam/result
import simplifile

pub type Shape {
  Shape(
    name: String,
    harness: String,
    model: String,
    max_turns: Int,
    max_tokens: Int,
    tools: List(String),
    price_in: Float,
    price_out: Float,
  )
}

pub fn decoder() -> decode.Decoder(Shape) {
  use name <- decode.field("name", decode.string)
  use harness <- decode.optional_field("harness", "native", decode.string)
  use model <- decode.field("model", decode.string)
  use max_turns <- decode.field("max_turns", decode.int)
  use max_tokens <- decode.field("max_tokens", decode.int)
  use tools <- decode.field("tools", decode.list(decode.string))
  use price_in <- decode.subfield(["price_per_m", "in"], number())
  use price_out <- decode.subfield(["price_per_m", "out"], number())
  decode.success(Shape(
    name:,
    harness:,
    model:,
    max_turns:,
    max_tokens:,
    tools:,
    price_in:,
    price_out:,
  ))
}

fn number() -> decode.Decoder(Float) {
  decode.one_of(decode.float, [decode.int |> decode.map(int_to_float)])
}

@external(erlang, "erlang", "float")
fn int_to_float(value: Int) -> Float

pub fn load(catalog_dir: String, name: String) -> Result(Shape, String) {
  let path = catalog_dir <> "/" <> name <> ".json"
  use text <- result.try(
    simplifile.read(path)
    |> result.map_error(fn(_) { "no shape file " <> path }),
  )
  json.parse(text, decoder())
  |> result.map_error(fn(_) { "bad shape file " <> path })
}
