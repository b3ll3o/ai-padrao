import type {
  ArgumentsHost} from "@nestjs/common";
import {
  BadRequestException,
  HttpException,
  Logger,
} from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";
import { ZodError } from "zod";

describe("HttpExceptionFilter", () => {
  const buildHost = () => {
    const status = jest.fn().mockReturnThis();
    const send = jest.fn().mockReturnThis();
    const response = { status, send };
    const request = { url: "/api/things" };
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    return { host, response, status, send, request };
  };

  it("maps ZodError to 400 with flattened fieldErrors", () => {
    const { host, response } = buildHost();
    const zod = new ZodError([
      {
        code: "invalid_type",
        path: ["email"],
        message: "Invalid email",
      } as never,
    ]);
    new HttpExceptionFilter().catch(zod, host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Validation failed",
        path: "/api/things",
      }),
    );
  });

  it("maps Nest HttpException to its declared status (string response)", () => {
    const { host, response } = buildHost();
    new HttpExceptionFilter().catch(
      new HttpException("plain error", 418),
      host,
    );
    expect(response.status).toHaveBeenCalledWith(418);
    expect(response.send).toHaveBeenCalledWith({
      statusCode: 418,
      message: "plain error",
      path: "/api/things",
    });
  });

  it("maps Nest HttpException (BadRequestException) to 400 with object body", () => {
    const { host, response } = buildHost();
    const bad = new BadRequestException("bad");
    new HttpExceptionFilter().catch(bad, host);
    expect(response.status).toHaveBeenCalledWith(400);
    // BadRequestException's response includes statusCode/message/error from Nest.
    const sent = response.send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent.path).toBe("/api/things");
    expect(sent.statusCode).toBe(400);
    expect(sent.message).toBe("bad");
  });

  it("maps unknown exceptions to 500 with generic message and logs error", () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const { host, response } = buildHost();
    new HttpExceptionFilter().catch(new Error("boom"), host);
    expect(errorSpy).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.send).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Internal server error",
      path: "/api/things",
    });
    errorSpy.mockRestore();
  });
});
