import "dotenv/config";
import { AnthropicClient } from "./core/llm.js";
import { SocialEngineeringAnalyzer } from "./core/socialEngineeringAnalyzer.js";
import { createApp } from "./http/routes.js";
const model = process.env.ANTHROPIC_MODEL;
if (!model || !process.env.ANTHROPIC_API_KEY) throw new Error("Configurar ANTHROPIC_MODEL y ANTHROPIC_API_KEY en el backend (ver .env.example)");
createApp(new SocialEngineeringAnalyzer(new AnthropicClient(model, process.env.ANTHROPIC_API_KEY))).listen(Number(process.env.PORT ?? 3001), "127.0.0.1", () => console.log("Fishi API en loopback"));
