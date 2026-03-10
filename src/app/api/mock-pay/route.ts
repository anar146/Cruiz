import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return NextResponse.json({ 
    success: true, 
    transactionId: `CRZ_${Math.random().toString(36).toUpperCase().slice(2, 10)}` 
  });
}