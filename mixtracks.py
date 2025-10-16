import json, random, os

# Đọc file cấu hình
with open("mix_tracks.json", "r", encoding="utf-8") as f:
    config = json.load(f)

all_questions = []

# Đọc từng track trong cấu hình
for t in config["tracks"]:
    file_path = t["file"]
    if not os.path.exists(file_path):
        print(f"⚠️ Không tìm thấy file: {file_path}")
        continue

    with open(file_path, "r", encoding="utf-8") as ftrack:
        data = json.load(ftrack)
        if "challenges" not in data:
            print(f"⚠️ File {file_path} không có trường 'challenges'")
            continue

        # Gắn thêm id nguồn (cpp, java, js...)
        for q in data["challenges"]:
            q["source"] = t["id"]
            all_questions.append(q)

# Trộn toàn bộ câu hỏi và chọn ngẫu nhiên
random.shuffle(all_questions)
selected = all_questions[:config["mixing_rule"]["count"]]

# Tạo file JSON kết quả
output = {
    "id": "mixed_quiz",
    "title": config["output"]["title"],
    "description": config["output"]["description"],
    "challenges": selected
}

# Ghi ra file kết quả
output_file = config["output"]["file"]
os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, "w", encoding="utf-8") as out:
    json.dump(output, out, indent=2, ensure_ascii=False)

print(f"✅ Đã tạo file '{output_file}' chứa {len(selected)} câu hỏi ngẫu nhiên!")
