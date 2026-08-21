import { ImageResponse } from "next/og";
import { FinanceMark } from "./icon-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<FinanceMark size={180} rounded={false} />, size);
}
