import { loadSmtpConfig } from "./smtp.js";

export const config = loadSmtpConfig();

export type Config = typeof config;
