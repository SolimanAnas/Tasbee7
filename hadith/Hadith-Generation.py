import os
import requests
import json

# مسار الحفظ المخصص لهاتفك (نظام أندرويد)
OUTPUT_DIR = "/storage/emulated/0/1-Zad Al-Muslim/JSON"

# قائمة بالكتب المتاحة (الكتب الستة الأساسية)
BOOKS = {
    "bukhari": "صحيح البخاري",
    "muslim": "صحيح مسلم",
    "abudawud": "سنن أبي داود",
    "tirmidhi": "جامع الترمذي",
    "nasai": "سنن النسائي",
    "ibnmajah": "سنن ابن ماجه"
}

def download_hadith_books():
    # التأكد من وجود المجلد، وإنشائه إذا لم يكن موجوداً
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        print(f"📂 تم تجهيز مسار الحفظ: {OUTPUT_DIR}\n")
    except Exception as e:
        print(f"❌ خطأ في إنشاء المجلد (تأكد من إعطاء التطبيق صلاحية الوصول للملفات): {e}")
        return

    for book_id, book_name in BOOKS.items():
        print(f"⏳ جاري تحميل {book_name}...")
        
        # رابط الـ API المفتوح والموثوق لجلب الكتاب بصيغة JSON
        url = f"https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-{book_id}.json"
        
        try:
            # طلب البيانات مع تحديد وقت أقصى لتجنب التعليق
            response = requests.get(url, timeout=30)
            response.raise_for_status() 
            
            # تحويل الاستجابة إلى JSON
            data = response.json()
            
            # مسار الملف النهائي
            file_path = os.path.join(OUTPUT_DIR, f"{book_id}.json")
            
            # حفظ الملف بترميز UTF-8 لدعم اللغة العربية بشكل سليم
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            # عرض عدد الأحاديث التي تم تحميلها للتأكيد
            hadiths_count = len(data.get('hadiths', []))
            print(f"✅ تم الحفظ بنجاح: {book_id}.json ({hadiths_count} حديث)\n")
            
        except requests.exceptions.RequestException as e:
            print(f"❌ حدث خطأ في الاتصال أثناء تحميل {book_name}: {e}\n")
        except Exception as e:
            print(f"❌ حدث خطأ غير متوقع أثناء تحميل {book_name}: {e}\n")

if __name__ == "__main__":
    print("🚀 بدء تشغيل سكريبت تحميل الأحاديث...\n" + "="*40)
    download_hadith_books()
    print("="*40 + "\n🎉 انتهت عملية التحديث!")
