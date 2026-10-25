-module(fleet_json_ffi).
-export([dynamic_to_json/1, get_string/2, merge_objects/2]).

dynamic_to_json(Value) -> json:encode(Value).

get_string(Map, Key) when is_map(Map) ->
    case maps:find(Key, Map) of
        {ok, V} when is_binary(V) -> {ok, V};
        _ -> {error, nil}
    end;
get_string(_, _) -> {error, nil}.

merge_objects(Base, Extra) ->
    B = try json:decode(Base) of M when is_map(M) -> M; _ -> #{} catch _:_ -> #{} end,
    E = json:decode(Extra),
    iolist_to_binary(json:encode(maps:merge(B, E))).
