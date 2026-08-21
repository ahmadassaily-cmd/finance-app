import { ImageResponse } from "next/og";
import { FinanceMark } from "./icon-mark";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<FinanceMark size={64} />, size);
}
