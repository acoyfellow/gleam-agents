-module(fleet_ffi).
-export([run_shell/3, now_ms/0, unique/0]).

run_shell(Command, Dir, TimeoutMs) ->
    Port = open_port({spawn_executable, "/bin/sh"},
                     [{args, ["-c", Command]}, {cd, Dir}, exit_status, stderr_to_stdout, binary, use_stdio]),
    Deadline = erlang:monotonic_time(millisecond) + TimeoutMs,
    collect(Port, [], Deadline).

collect(Port, Acc, Deadline) ->
    Left = max(0, Deadline - erlang:monotonic_time(millisecond)),
    receive
        {Port, {data, Chunk}} -> collect(Port, [Chunk | Acc], Deadline);
        {Port, {exit_status, Code}} -> {Code, iolist_to_binary(lists:reverse(Acc))}
    after Left ->
        try port_close(Port) catch _:_ -> ok end,
        {124, iolist_to_binary([lists:reverse(Acc), <<"\n(timed out)">>])}
    end.

now_ms() -> erlang:monotonic_time(millisecond).

unique() -> integer_to_binary(erlang:unique_integer([positive])).
