import Image from "next/image";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-brand-cream">
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="/Hình đại diện Trạm.jpg"
          alt="Không gian TRẠM Coworking Space"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-forest/80 via-brand-forest/10 to-transparent" />
        <div className="absolute bottom-12 left-10 right-10 text-brand-cream">
          <p className="text-2xl font-bold">Kết nối · Tập trung · Bứt phá</p>
          <p className="mt-1 text-sm text-brand-cream/80">
            Không gian làm việc chung TRẠM Coworking Space
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-brand-forest/20 bg-white p-8 shadow-sm">
          <Image
            src="/LOGO.jpg"
            alt="TRẠM Coworking Space"
            width={72}
            height={72}
            priority
            className="mx-auto mb-3 rounded-full"
          />
          <Image
            src="/tram-wordmark.png"
            alt="TRẠM"
            width={1246}
            height={278}
            priority
            className="mx-auto h-8 w-auto"
          />
          <p className="mb-1 mt-1.5 text-center text-xs font-semibold tracking-[0.25em] text-brand-forest/70">
            COWORKING SPACE
          </p>
          <p className="mb-6 text-center text-sm text-brand-forest/70">
            Đăng nhập quản lý đặt chỗ
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
