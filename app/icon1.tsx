import { ImageResponse } from "next/og";
import { FinanceMark } from "./icon-mark";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<FinanceMark size={192} />, size);
}
