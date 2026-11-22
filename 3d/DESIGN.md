# Sòng Đêm 3D: bản thử

Một lát cắt nhỏ của Sòng Đêm chuyển sang 3D cho điện thoại. Chạy thẳng trên GitHub Pages, không cần build.

## Design brief
- **Lời hứa:** đi dạo thành phố đêm của Sòng Đêm, từ nhà mình tới sòng bạc, thời gian trôi liên tục.
- **Cảm giác:** thành phố đêm ấm, neon tím hồng và vàng, nhẹ nhàng, không áp lực.
- **Động từ chính:** đi bộ hoặc chạy. **Phụ:** xoay camera, vào nhà, vào casino, ngủ hoặc nghỉ để tua giờ.
- **Lặp lại mỗi 5–30 giây:** di chuyển giữa các khu nhà, nhìn đồng hồ, tới cửa thì hiện nút hành động.
- **Thay đổi sau 1–5 phút:** đồng hồ trong game chạy 1 phút game mỗi 20 giây thật, trời chuyển từ đêm sang sáng.
- **Ngoài phạm vi bản thử:** tiền, chơi bài bên trong casino, xe, online, nhiệm vụ.

## Core loop (bản thử)
Người chơi đi từ nhà tới Sòng Đêm trong khi đồng hồ tự chạy. Nhà cho phép ngủ tới 7:00 hoặc nghỉ 1 giờ, làm thay đổi trạng thái đồng hồ và ánh sáng. Casino hiện thông báo bản thử.

## Bản đồ
- Dựng từ bộ KayKit City Builder Bits trên lưới ô 12 m: khối nhà 3×3 ô (36 m), đường rộng 1 ô.
- Lưới 3×3 khối đi lại được (gọn để tải nhanh), thêm dãy nhà bên kia đường vành đai để nhìn cho kín.
- Có xe chạy vòng (lái bên phải, dừng khi người chơi đứng trước), xe đỗ ven đường và 8 người đi bộ (4 kiểu) trên vỉa hè.
- Khối giữa: **Sòng Đêm**, có biển neon và đồng xu vàng xoay trên mái làm mốc.
- Khối phía tây: **Nhà** có vườn, hàng rào và lối đi. Người chơi bắt đầu ở cửa nhà.
- Khối phía đông: công viên có đài phun nước.
- Các khối còn lại: tòa nhà KayKit, cửa sổ sáng về đêm.
- Sương mù giấu mép bản đồ.

## Nhân vật
- 12 nhân vật từ bộ Vocations and Uniforms, chọn bằng nút góc trái trên.
- Mô hình gốc ở tư thế chữ T và không có animation, nên dáng đứng, đi, chạy được tạo bằng cách xoay xương trong `character.js`.

## Menu và màn hình tải
- Giống bản 2D: menu chính (Tiếp tục / Chơi mới / Mở bản 2D) và rèm tải kéo lên, font tiêu đề Bungee lấy từ bản 2D.
- Tài nguyên bắt đầu tải ngay khi mở trang, trong lúc người chơi còn ở menu.
- Trong game: nút ☰ hoặc phím Esc mở menu tạm dừng (dừng đồng hồ), có thêm Đổi nhân vật.

## Thời gian
- `20 giây thật = 1 phút trong game`. 1 giờ game bằng 20 phút thật.
- Bắt đầu lúc 21:00 ngày 1. Lưu vào máy (localStorage).
- Mặt trời, mặt trăng, sao, màu trời, đèn đường và cửa sổ đều theo giờ.
- Nút tua ×30 chỉ để xem nhanh ngày và đêm, mặc định ×1.

## Điều khiển
- Điện thoại: kéo nửa trái để đi (joystick hiện ở chỗ chạm, đẩy hết cỡ là chạy), kéo nửa phải để xoay camera.
- Máy tính: WASD hoặc mũi tên, Shift để chạy, kéo chuột để xoay, E để vào.

## Cơ chế đã có (thêm dần)
- **Nhảy:** nút ↑ hoặc phím Space. Đứng lên được hiên nhà, bậc thềm casino và ngân hàng.
- **Tiền:** ví (tiền mặt) bắt đầu với $1.000 như bản 2D, cùng tài khoản BruhBank. Có lưu lịch sử giao dịch.
- **Điện thoại:** giao diện như bản 2D, gồm Ví của tôi, BruhBank, Bản đồ (chỉ đường bằng cột sáng) và Cài đặt (tua giờ, về menu).
- **BruhBank:** ATM mở 24/7 (rút tối đa $2.000 mỗi lần) và quầy giao dịch mở 8:00–17:00 theo giờ trong game.
- **Trong nhà:** phòng kiểu nhà búp bê với nội thất KayKit Furniture. Nằm giường để ngủ tới 7:00 hoặc nghỉ 1 tiếng.
- **Chưa có:** bên trong casino và cách kiếm tiền. Đây là bước kế tiếp.
