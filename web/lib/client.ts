"use client";
import { createAnonymousKey, TOKEN_PATTERN } from "./domain";
export const IDENTITY_STORAGE = "repapp.anonymous-key.v1";
export type ApiClient = <T>(path: string, init?: RequestInit) => Promise<T>;
export function loadIdentity(): { token: string; temporary: boolean } {
  try {
    const saved = localStorage.getItem(IDENTITY_STORAGE);
    const token =
      saved && TOKEN_PATTERN.test(saved) ? saved : createAnonymousKey();
    localStorage.setItem(IDENTITY_STORAGE, token);
    return { token, temporary: false };
  } catch {
    return { token: createAnonymousKey(), temporary: true };
  }
}
export function clientFor(token: string): ApiClient {
  return async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`/api/${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    let data: { error?: string };
    try {
      data = await response.json();
    } catch {
      throw new Error("Couldn’t reach the common room. Please try again.");
    }
    if (!response.ok)
      throw new Error(data.error ?? "Something went wrong. Please try again.");
    return data as T;
  };
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
