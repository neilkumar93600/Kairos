import { describe, expect, it } from "vitest";
import { parseSeedFile } from "../scripts/seed-companies";

const row = { ats: "greenhouse", boardToken: "acme", name: "Acme" };

describe("parseSeedFile", () => {
  it("fills the defaults", () => {
    expect(parseSeedFile(JSON.stringify([row]))).toEqual([{ ...row, region: "us", careersUrl: null, domains: [], priority: false }]);
  });

  it("takes a Lever EU board, and no other EU board", () => {
    expect(parseSeedFile(JSON.stringify([{ ...row, ats: "lever", region: "eu" }]))[0]!.region).toBe("eu");
    expect(() => parseSeedFile(JSON.stringify([{ ...row, region: "eu" }]))).toThrow(/only Lever/);
  });

  it("refuses a token, a domain or a careers URL the database or the poller would not take, naming the row", () => {
    expect(() => parseSeedFile(JSON.stringify([row, { ...row, boardToken: "../x" }]))).toThrow(/^1\.boardToken/);
    expect(() => parseSeedFile(JSON.stringify([{ ...row, domains: ["Acme.COM"] }]))).toThrow(/lower-case/);
    expect(() => parseSeedFile(JSON.stringify([{ ...row, careersUrl: "http://acme.example" }]))).toThrow(/https only/);
  });

  it("refuses a board listed twice", () => {
    expect(() => parseSeedFile(JSON.stringify([row, row]))).toThrow(/listed twice/);
  });
});
