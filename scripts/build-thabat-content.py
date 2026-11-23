# Builds js/thabat-content.js for pages/thabat.html: verses are taken verbatim from
# data/quran.json. Run: python3 scripts/build-thabat-content.py
import json, os, re, unicodedata
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
Q = {(a['surah'], a['ayah']): a for a in json.load(open(os.path.join(ROOT, 'data', 'quran.json')))}
def ayah(s, a1, a2=None):
    a2 = a2 or a1
    # «۞» (U+06DE) marks a quarter of a hizb in the mushaf; it is not part of the verse
    clean = lambda t: t.replace('\ufeff', '').replace('\u06de', '').strip()
    txt = ' '.join(clean(Q[(s, i)]['text_uthmani']) + (f' ﴿{i}﴾' if a2 > a1 else '') for i in range(a1, a2 + 1))
    # the label is set in Tajawal, which has no glyph for the Uthmani sukun (U+06E1, drawn as
    # a box in «إِبۡرَاهِيمَ») or the wasla: show the plain name, «سورة إبراهيم» (NFC first,
    # so ا + madd stays «آ» in «آل عمران»)
    name = re.sub('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]', '', unicodedata.normalize('NFC', Q[(s, a1)]['surah_name']).replace('سُورَةُ ', '').replace('\u0671', '\u0627'))
    return txt, name
AYAT = [
 ((39, 53), 'Say: O My servants who have transgressed against themselves, do not despair of the mercy of Allah. Indeed, Allah forgives all sins. He is the Forgiving, the Merciful.', 'لا قنوط'),
 ((29, 69), 'And those who strive for Us — We will surely guide them to Our ways. And indeed, Allah is with the doers of good.', 'مجاهدة'),
 ((14, 27), 'Allah keeps firm those who believe, with the firm word, in this worldly life and in the Hereafter.', 'تثبيت'),
 ((3, 135), 'And those who, when they commit an immorality or wrong themselves, remember Allah and seek forgiveness for their sins — and who forgives sins except Allah? — and do not persist in what they have done while they know.', 'استغفار'),
 ((2, 222), 'Indeed, Allah loves those who constantly repent and loves those who purify themselves.', 'محبة'),
 ((24, 31), 'And turn to Allah in repentance, all of you, O believers, that you might succeed.', 'توبة'),
 ((25, 70), 'Except for those who repent, believe and do righteous work — for them Allah will replace their evil deeds with good. And ever is Allah Forgiving and Merciful.', 'تبديل'),
 ((41, 30), 'Indeed, those who have said, "Our Lord is Allah" and then remained steadfast — the angels will descend upon them: "Do not fear and do not grieve, but receive good tidings of Paradise, which you were promised."', 'استقامة'),
 ((7, 201), 'Indeed, those who fear Allah — when an impulse touches them from Satan, they remember Him, and at once they have insight.', 'يقظة'),
 ((65, 2, 3), 'And whoever fears Allah — He will make for him a way out, and will provide for him from where he does not expect.', 'مخرج'),
 ((16, 127), 'And be patient, and your patience is not but through Allah.', 'صبر'),
 ((15, 99), 'And worship your Lord until there comes to you the certainty (death).', 'دوام'),
 ((3, 8), 'Our Lord, let not our hearts deviate after You have guided us, and grant us from Yourself mercy. Indeed, You are the Bestower.', 'دعاء'),
]
HADITH = [
 ('«يأتي على الناس زمانٌ الصابرُ فيهم على دينه كالقابض على الجمر».', 'رواه الترمذي، وصحّحه الألباني',
  '"A time will come upon people when the one who holds patiently to his religion among them will be like one holding a burning coal."'),
 ('«أذنب عبدٌ ذنبًا فقال: اللهم اغفر لي ذنبي، فقال تبارك وتعالى: أذنب عبدي ذنبًا فعلم أن له ربًّا يغفر الذنب ويأخذ بالذنب، ثم عاد فأذنب… اعمل ما شئت فقد غفرت لك».', 'رواه البخاري ومسلم',
  '"A servant committed a sin and said: O Allah, forgive me my sin. Allah said: My servant sinned and knew he has a Lord who forgives sin and holds to account for it… Then he sinned again… Do as you wish, I have forgiven you."'),
 ('«لَلَّهُ أفرحُ بتوبة عبده من أحدكم سقط على بعيره وقد أضلّه في أرض فلاة».', 'رواه البخاري ومسلم',
  '"Allah is more pleased with the repentance of His servant than one of you who finds his camel after losing it in a desert."'),
 ('«إن الله عز وجل يبسط يده بالليل ليتوب مسيء النهار، ويبسط يده بالنهار ليتوب مسيء الليل، حتى تطلع الشمس من مغربها».', 'رواه مسلم',
  '"Allah stretches out His hand at night so that the one who sinned by day may repent, and by day so that the one who sinned by night may repent — until the sun rises from the west."'),
 ('«كلُّ ابن آدم خطّاء، وخير الخطّائين التوّابون».', 'رواه الترمذي وابن ماجه، وحسّنه الألباني',
  '"Every son of Adam errs, and the best of those who err are those who repent."'),
 ('«التائب من الذنب كمن لا ذنب له».', 'رواه ابن ماجه، وحسّنه الألباني',
  '"The one who repents from sin is like one who has no sin."'),
 ('«قال الله تعالى: يا ابن آدم، إنك ما دعوتني ورجوتني غفرت لك على ما كان فيك ولا أبالي».', 'رواه الترمذي، وصحّحه الألباني',
  '"Allah said: O son of Adam, as long as you call upon Me and hope in Me, I will forgive you whatever you have done, and I do not mind."'),
 ('قال سفيان بن عبد الله: يا رسول الله، قل لي في الإسلام قولًا لا أسأل عنه أحدًا بعدك، قال: «قل: آمنت بالله، ثم استقم».', 'رواه مسلم',
  'Sufyan asked: "Tell me something about Islam I will not need to ask anyone after you." He said: "Say: I believe in Allah — then be steadfast."'),
 ('«أحبُّ الأعمال إلى الله أدومها وإن قلّ».', 'رواه البخاري ومسلم',
  '"The deeds most beloved to Allah are the most constant, even if small."'),
 ('«ومن يستعففْ يُعِفَّه الله، ومن يستغنِ يُغنِه الله، ومن يتصبّرْ يُصبِّره الله، وما أُعطي أحدٌ عطاءً خيرًا وأوسع من الصبر».', 'رواه البخاري ومسلم',
  '"Whoever seeks chastity, Allah makes him chaste; whoever seeks self-sufficiency, Allah suffices him; whoever strives to be patient, Allah gives him patience. No one is given anything better or more vast than patience."'),
 ('«إنك لن تدع شيئًا لله عز وجل إلا بدّلك الله به ما هو خيرٌ لك منه».', 'رواه أحمد، وصحّحه الألباني',
  '"You will never leave something for the sake of Allah except that Allah will replace it with something better for you."'),
 ('«احرص على ما ينفعك، واستعن بالله ولا تعجز».', 'رواه مسلم',
  '"Be keen on what benefits you, seek help from Allah, and do not give up."'),
 ('«يا أيها الناس، توبوا إلى الله، فإني أتوب في اليوم إليه مائة مرة».', 'رواه مسلم',
  '"O people, repent to Allah, for I repent to Him a hundred times a day."'),
 ('«كلُّ أمتي معافى إلا المجاهرين»؛ فاستتر بستر الله، ولا تحدّث بذنبٍ ستره الله عليك.', 'رواه البخاري ومسلم',
  '"All of my nation will be pardoned except those who sin openly" — so keep Allah\'s covering, and do not speak of a sin Allah has concealed.'),
]
DUA = [
 ('«يا مقلِّبَ القلوب، ثبِّت قلبي على دينك».', 'رواه الترمذي', '"O Turner of hearts, make my heart firm upon Your religion."'),
 ('«اللهم مصرِّفَ القلوب، صرِّف قلوبنا على طاعتك».', 'رواه مسلم', '"O Allah, Director of hearts, direct our hearts to Your obedience."'),
 (None, (2, 250), '"Our Lord, pour upon us patience, plant firmly our feet, and give us victory."'),
 ('«اللهم آتِ نفسي تقواها، وزكِّها أنت خيرُ من زكّاها، أنت وليُّها ومولاها».', 'رواه مسلم', '"O Allah, grant my soul its piety and purify it; You are the best to purify it, its Guardian and Master."'),
 ('«اللهم إني أسألك الهدى والتقى، والعفاف والغنى».', 'رواه مسلم', '"O Allah, I ask You for guidance, piety, chastity and self-sufficiency."'),
 ('«ربِّ اغفر لي وتُب عليَّ، إنك أنت التوّاب الرحيم».', 'رواه أبو داود والترمذي', '"My Lord, forgive me and accept my repentance; You are the Accepter of repentance, the Merciful."'),
 ('«اللهم اغفر لي ذنبي كلَّه: دِقَّه وجِلَّه، وأوَّله وآخره، وعلانيته وسِرَّه».', 'رواه مسلم', '"O Allah, forgive me all my sins: the small and the great, the first and the last, the open and the secret."'),
 ('«اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك عليَّ، وأبوء بذنبي، فاغفر لي فإنه لا يغفر الذنوب إلا أنت».', 'سيد الاستغفار — رواه البخاري', 'The master of seeking forgiveness: "O Allah, You are my Lord… I acknowledge Your favour upon me and I acknowledge my sin, so forgive me, for none forgives sins except You."'),
 ('«اللهم إني أعوذ بك من الهمّ والحزن، والعجز والكسل، والجبن والبخل، وضَلَع الدَّين وغلبة الرجال».', 'رواه البخاري', '"O Allah, I seek refuge in You from worry and grief, incapacity and laziness, cowardice and miserliness, the burden of debt and being overpowered by men."'),
 ('«أستغفر الله العظيم الذي لا إله إلا هو الحيَّ القيوم وأتوب إليه».', 'رواه أبو داود والترمذي', '"I seek forgiveness from Allah the Mighty, there is no god but He, the Living, the Sustainer, and I repent to Him."'),
]
# For the Qur'an wird journeys: verses and hadith on reciting and keeping up the Qur'an
QURAN_AYAT = [
 ((35, 29), 'Indeed, those who recite the Book of Allah, establish prayer and spend from what We have provided them, secretly and publicly, hope for a transaction that will never perish.'),
 ((54, 17), 'And We have certainly made the Qur\'an easy to remember, so is there any who will remember?'),
 ((38, 29), '(This is) a blessed Book which We have revealed to you, that they might reflect upon its verses and that those of understanding would be reminded.'),
 ((17, 9), 'Indeed, this Qur\'an guides to that which is most upright and gives good tidings to the believers who do righteous deeds that they will have a great reward.'),
 ((73, 4), 'Or add to it, and recite the Qur\'an with measured recitation.'),
 ((13, 28), 'Those who have believed and whose hearts are assured by the remembrance of Allah. Unquestionably, by the remembrance of Allah hearts are assured.'),
]
QURAN_HADITH = [
 ('«اقرؤوا القرآن؛ فإنه يأتي يوم القيامة شفيعًا لأصحابه».', 'رواه مسلم', '"Recite the Qur\'an, for it will come on the Day of Resurrection as an intercessor for its companions."'),
 ('«من قرأ حرفًا من كتاب الله فله به حسنة، والحسنة بعشر أمثالها، لا أقول: الم حرف، ولكن ألفٌ حرف، ولامٌ حرف، وميمٌ حرف».', 'رواه الترمذي، وصحّحه الألباني', '"Whoever reads a letter from the Book of Allah has a good deed for it, and a good deed is multiplied by ten…"'),
 ('«الماهر بالقرآن مع السفرة الكرام البررة، والذي يقرأ القرآن ويتتعتع فيه وهو عليه شاقٌّ له أجران».', 'رواه البخاري ومسلم', '"The one skilled in the Qur\'an is with the noble, righteous scribes; and the one who recites it haltingly, finding it hard, has two rewards."'),
 ('«خيركم من تعلّم القرآن وعلّمه».', 'رواه البخاري', '"The best of you are those who learn the Qur\'an and teach it."'),
 ('«يُقال لصاحب القرآن: اقرأ وارتقِ ورتّل كما كنت ترتّل في الدنيا، فإن منزلك عند آخر آية تقرؤها».', 'رواه أبو داود والترمذي، وصحّحه الألباني', '"It will be said to the companion of the Qur\'an: Recite and rise, and recite as you used to in the world, for your rank is at the last verse you recite."'),
 ('«من نام عن حزبه أو عن شيءٍ منه، فقرأه فيما بين صلاة الفجر وصلاة الظهر، كُتب له كأنما قرأه من الليل».', 'رواه مسلم', '"Whoever sleeps through his portion (of the night\'s recitation) or part of it, and reads it between Fajr and Dhuhr, it is recorded for him as if he had read it at night."'),
 ('«أحبُّ الأعمال إلى الله أدومها وإن قلّ».', 'رواه البخاري ومسلم', '"The deeds most beloved to Allah are the most constant, even if small."'),
]
AR = lambda x: str(x).translate(str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩'))
out = {'ayat': [], 'hadith': [], 'dua': [], 'quran': []}
for ref, en, tag in AYAT:
    t, name = ayah(*ref)
    if ref == (65, 2, 3):   # only the promise: «ومن يتق الله يجعل له مخرجا ۝ ويرزقه من حيث لا يحتسب»
        a2 = Q[(65, 2)]['text_uthmani']; a3 = Q[(65, 3)]['text_uthmani']
        t = a2[a2.rindex('وَمَن'):] + ' ۝ ' + a3[:a3.index(' ۚ')] + ' …'
    # quote only the part of a long verse that speaks of repentance (the openings are on other rulings)
    if ref in ((2, 222), (24, 31)):
        full = Q[ref]['text_uthmani']; t = '… ' + full[full.rindex(' ۚ ') + 3:]
    r = f'سورة {name} {AR(ref[1])}' + (f'–{AR(ref[2])}' if len(ref) > 2 else '')
    out['ayat'].append({'ar': f'﴿{t}﴾', 'src': r, 'en': en})
for ar, src, en in HADITH: out['hadith'].append({'ar': ar, 'src': src, 'en': en})
for ar, src, en in DUA:
    if ar is None:
        t, name = ayah(*src); out['dua'].append({'ar': f'﴿{t}﴾', 'src': f'سورة {name} {AR(src[1])}', 'en': en})
    else: out['dua'].append({'ar': ar, 'src': src, 'en': en})
for ref, en in QURAN_AYAT:
    t, name = ayah(*ref)
    out['quran'].append({'ar': f'﴿{t}﴾', 'src': f'سورة {name} {AR(ref[1])}', 'en': en})
for ar, src, en in QURAN_HADITH: out['quran'].append({'ar': ar, 'src': src, 'en': en})
# the growth panel: «كشجرة طيبة أصلها ثابت وفرعها في السماء» (only this part of Ibrahim 24)
_t = Q[(14, 24)]['text_uthmani']
out['tree'] = {'ar': '﴿… ' + _t[_t.index('كَشَجَرَةٍ'):] + '﴾', 'src': 'سورة إبراهيم ٢٤',
               'en': '… like a good tree, whose root is firmly fixed and whose branches are high in the sky.'}
js = ('/* thabat-content.js — verses (verbatim from data/quran.json), hadith and duas on\n'
      '   repentance and steadfastness for pages/thabat.html. Generated by scripts/build-thabat-content.py. */\n'
      'window.THABAT_CONTENT = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
open(os.path.join(ROOT, 'js', 'thabat-content.js'), 'w').write(js)
print({k: len(v) for k, v in out.items()})
