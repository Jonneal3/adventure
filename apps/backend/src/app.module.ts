import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { ExperienceController } from "./experience.controller.js";
import { VisualController } from "./visual.controller.js";
import { BillingController } from "./billing.controller.js";
@Module({ controllers: [AppController, ExperienceController, VisualController, BillingController] })
export class AppModule {}
