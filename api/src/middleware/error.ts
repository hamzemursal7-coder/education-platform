import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (error && typeof error === "object" && "status" in error && typeof (error as any).status === "number") {
    const status = (error as any).status;
    if (status >= 400 && status < 600) {
      res.status(status).json({ message: (error as any).message || "Request failed." });
      return;
    }
  }
  console.error(error);
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  res.status(500).json({ message: msg });
}
