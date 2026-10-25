import gleam/dynamic/decode
import gleam/json
import gleam/result
import simplifile

pub type Seat {
  Seat(
    id: String,
    shape: String,
    goal: String,
    prompt_file: String,
    seed: String,
    writable: List(String),
    test_command: String,
    grade_command: String,
  )
}

pub type Plan {
  Plan(name: String, baseline: String, seats: List(Seat))
}

fn seat_decoder() -> decode.Decoder(Seat) {
  use id <- decode.field("id", decode.string)
  use shape <- decode.field("shape", decode.string)
  use goal <- decode.field("goal", decode.string)
  use prompt_file <- decode.field("prompt_file", decode.string)
  use seed <- decode.field("seed", decode.string)
  use writable <- decode.field("writable", decode.list(decode.string))
  use test_command <- decode.field("test_command", decode.string)
  use grade_command <- decode.field("grade_command", decode.string)
  decode.success(Seat(
    id:,
    shape:,
    goal:,
    prompt_file:,
    seed:,
    writable:,
    test_command:,
    grade_command:,
  ))
}

fn plan_decoder() -> decode.Decoder(Plan) {
  use name <- decode.field("name", decode.string)
  use baseline <- decode.field("baseline", decode.string)
  use seats <- decode.field("seats", decode.list(seat_decoder()))
  decode.success(Plan(name:, baseline:, seats:))
}

pub fn load(path: String) -> Result(Plan, String) {
  use text <- result.try(
    simplifile.read(path) |> result.replace_error("no plan " <> path),
  )
  json.parse(text, plan_decoder()) |> result.replace_error("bad plan " <> path)
}
