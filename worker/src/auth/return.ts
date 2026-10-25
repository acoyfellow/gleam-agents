const SAFE_RETURN = /^\/(docs|reports|cli\/approve)(\/[a-zA-Z0-9_.-]*)?(\?[a-zA-Z0-9_=&.-]*)?$/u;

export const safeReturn = (raw: string | null | undefined): string => (raw && SAFE_RETURN.test(raw) ? raw : '/');
