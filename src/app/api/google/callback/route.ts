import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  googleClientId,
  googleClientSecret,
  saveGoogleDriveConnection,
} from "@/lib/google-drive";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const staffUrl = new URL("/staff", url.origin);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  if (oauthError) {
    staffUrl.searchParams.set("google_error", "Đã hủy kết nối Google Drive.");
    return NextResponse.redirect(staffUrl);
  }

  if (!code || !state || state !== expectedState) {
    staffUrl.searchParams.set("google_error", "Phiên kết nối không hợp lệ, thử lại.");
    return NextResponse.redirect(staffUrl);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  try {
    const redirectUri = `${url.origin}/api/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Đổi mã lấy token thất bại (${tokenRes.status}).`);
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
    };
    if (!tokenJson.refresh_token) {
      throw new Error("Google không trả về refresh token — thử kết nối lại.");
    }

    const aboutRes = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user",
      { headers: { Authorization: `Bearer ${tokenJson.access_token}` } }
    );
    if (!aboutRes.ok) {
      throw new Error(`Không lấy được thông tin tài khoản Google (${aboutRes.status}).`);
    }
    const aboutJson = (await aboutRes.json()) as {
      user: { emailAddress: string };
    };

    await saveGoogleDriveConnection({
      refresh_token: tokenJson.refresh_token,
      email: aboutJson.user.emailAddress,
    });

    staffUrl.searchParams.set("google_connected", aboutJson.user.emailAddress);
  } catch (err) {
    staffUrl.searchParams.set(
      "google_error",
      err instanceof Error ? err.message : "Kết nối Google Drive thất bại."
    );
  }

  const response = NextResponse.redirect(staffUrl);
  response.cookies.delete("google_oauth_state");
  return response;
}
