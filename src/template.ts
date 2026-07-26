import Handlebars from "handlebars";
import rawTemplate from "./templates/report.hbs" with { type: "text" };

const template = Handlebars.compile(rawTemplate);

export function renderReportHtml(payloadBase64: string): string {
  return template({ payloadBase64 });
}
