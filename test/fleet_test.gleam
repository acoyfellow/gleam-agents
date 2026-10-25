import fleet/scope
import gleeunit

pub fn main() -> Nil {
  gleeunit.main()
}

fn s() -> scope.Scope {
  scope.Scope(root: "/w", writable: ["src/catalog.ts", "test/"])
}

pub fn writable_exact_file_test() {
  assert scope.writable(s(), "src/catalog.ts") == Ok("/w/src/catalog.ts")
}

pub fn writable_directory_prefix_test() {
  assert scope.writable(s(), "test/new.test.ts") == Ok("/w/test/new.test.ts")
}

pub fn refuses_file_outside_scope_test() {
  let assert Error(scope.NotWritable(..)) = scope.writable(s(), "src/tax.ts")
}

pub fn refuses_parent_escape_test() {
  let assert Error(scope.Escapes(..)) = scope.writable(s(), "test/../../etc/passwd")
  let assert Error(scope.Escapes(..)) = scope.resolve(s(), "/etc/passwd")
}

pub fn reads_anywhere_inside_root_test() {
  assert scope.resolve(s(), "src/tax.ts") == Ok("/w/src/tax.ts")
}
