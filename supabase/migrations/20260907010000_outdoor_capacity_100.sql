-- Khu ngồi ngoài: sức chứa thực tế 100 chỗ (thay vì 30 lúc seed ban đầu)
update public.locations
set capacity = 100
where type = 'ghế ngoài';
