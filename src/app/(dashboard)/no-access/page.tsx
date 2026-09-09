export default function NoAccessPage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-brand-forest/15 bg-white p-8 text-center">
      <h1 className="mb-2 text-xl font-bold text-brand-forest">Chưa được cấp quyền</h1>
      <p className="text-sm text-brand-forest/60">
        Tài khoản của bạn hiện chưa được bật quyền truy cập module nào. Vui lòng liên
        hệ quản trị viên để được cấp quyền.
      </p>
    </div>
  );
}
