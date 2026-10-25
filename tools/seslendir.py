#!/usr/bin/env python3
"""Oyun sunucusunun sesli komutlarını Gemini TTS ile üretir (Miqqo reel hattındaki yöntem).

Kullanım:
  python3 tools/seslendir.py                 # bütün gruplar
  python3 tools/seslendir.py poz surat       # yalnızca bu gruplar
  python3 tools/seslendir.py --bol           # API'ye gitmeden önbellekteki sesleri yeniden böl

Her grup tek istekte okunur (ücretsiz katman günde 10 istek), sonra sessizliklerden satırlara bölünür.
Her parça Whisper ile dinlenir; metinle uyuşmayan satırlar listelenir.
Girdi : tools/voice-lines.json   Çıktı: audio/voice/<id>.mp3
Anahtar: ~/Claude/VideoEdit/.env (GEMINI_API_KEY, isteğe bağlı GEMINI_API_KEY_2). Anahtar hiçbir yere yazılmaz.
"""
import base64
import difflib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "tools", ".work")
OUT = os.path.join(ROOT, "audio", "voice")
MODEL = "gemini-3.8-flash-tts"
ENV_FILES = [os.path.expanduser("~/Claude/VideoEdit/.env"), os.path.expanduser("~/Claude/MiqqoSite/reels/.env")]
WHISPER = os.path.expanduser("~/Claude/VideoEdit/models/ggml-large-v3-turbo.bin")
# Kuru stüdyo hissini alan hafif zincir: tıslama ve tiz kısılır, biraz sıcaklık, çok az oda
CHAIN = ("highpass=f=80,deesser=i=0.5:m=0.5:f=0.5,equalizer=f=2800:t=q:w=1.4:g=0.8,highshelf=f=6500:g=-2.5,"
         "equalizer=f=260:t=q:w=1:g=1,acompressor=threshold=-20dB:ratio=2:attack=10:release=160:makeup=1.5,"
         "aecho=0.9:0.5:23|37:0.07|0.045,loudnorm=I=-15:TP=-1.5:LRA=9")


def keys():
    for path in ENV_FILES:
        if os.path.exists(path):
            vals = dict(line.strip().split("=", 1) for line in open(path) if "=" in line and not line.startswith("#"))
            found = [vals[k] for k in ("GEMINI_API_KEY", "GEMINI_API_KEY_2") if vals.get(k)]
            if found:
                return found
    raise SystemExit("GEMINI_API_KEY bulunamadı")


def tts(text, voice, style, key):
    body = {
        "model": MODEL,
        "input": [{"type": "user_input", "content": [{
            "type": "text", "text": text,
            "annotations": [{"type": "speech_metadata", "style": style}],
        }]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        data=json.dumps(body).encode(),
        headers={"x-goog-api-key": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    audio = [c for s in data.get("steps", []) if s.get("type") == "model_output"
             for c in s.get("content", []) if c.get("type") == "audio"]
    if not audio:
        raise SystemExit("ses dönmedi: " + json.dumps(data)[:400])
    return base64.b64decode(audio[-1]["data"])


def generate(cfg, group, path):
    # Sahne tarifi yalnızca stil kanalında; metinde sadece okunacak satırlar var, yönerge okunmaz
    text = "\n".join(t for _, t in group["lines"])
    style = (f"{cfg['persona']}. Scene: {cfg['scene']} Style: {cfg['style']} Pace: {cfg['pace']} "
             f"Accent: {cfg['accent']} Context: {cfg['context']} Notes for these lines: {group['note']}")
    ks, k = keys(), 0
    for attempt in range(8):
        try:
            audio = tts(text, cfg["voice"], style, ks[k])
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="ignore")
            if e.code != 429 or attempt == 7:
                raise SystemExit(f"Gemini hatası {e.code}: {msg[:300]}")
            m = re.search(r"retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s", msg)
            wait = (int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + float(m.group(3)) + 2) if m else 25
            if wait > 180:
                if k + 1 < len(ks):
                    k += 1
                    print("  günlük limit doldu, yedek anahtara geçiliyor")
                    continue
                raise SystemExit(f"Günlük limit doldu, {wait / 3600:.1f} saat sonra tekrar dene.")
            print(f"  limit doldu, {wait:.0f} sn bekleniyor")
            time.sleep(wait)
    raw = path + ".bin"
    open(raw, "wb").write(audio)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", CHAIN, "-ar", "48000", "-ac", "1", path], check=True)
    os.remove(raw)


def speech_spans(path, gap):
    """Sessizlik aralıklarından konuşma parçalarını çıkarır."""
    err = subprocess.run(["ffmpeg", "-i", path, "-af", f"silencedetect=noise=-40dB:d={gap}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                               capture_output=True, text=True).stdout)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    spans, cur = [], 0.0
    for s, e in zip(starts, ends + [dur] * (len(starts) - len(ends))):
        if s - cur > 0.08:
            spans.append((cur, s))
        cur = e
    if dur - cur > 0.08:
        spans.append((cur, dur))
    return spans


def norm(s):
    s = s.replace("I", "ı").replace("İ", "i").lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z ]", "", s).strip()


def hear(path):
    if not os.path.exists(WHISPER):
        return ""
    tmp = path + ".16k.wav"
    # Çok kısa parçalar için sona sessizlik eklenir; Whisper tek kelimede daha iyi duyar
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-af", "apad=pad_dur=1", "-ar", "16000", "-ac", "1", tmp], check=True)
    out = subprocess.run(["whisper-cli", "-m", WHISPER, "-l", "tr", "-f", tmp, "-nt"], capture_output=True, text=True).stdout
    os.remove(tmp)
    return re.sub(r"\s+", " ", out).strip()


def cut(path, a, b, dst):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ss", f"{a:.3f}", "-to", f"{b:.3f}", dst], check=True)


def align(path, lines):
    """Satır içi duraklar fazladan parça yaratırsa: küçük parçaları Whisper ile dinleyip
    ardışık parçaları satırlara en iyi uyacak şekilde birleştirir (dinamik programlama)."""
    spans = speech_spans(path, 0.2)
    heard = []
    for j, (a, b) in enumerate(spans):
        tmp = os.path.join(WORK, f"_parca{j}.wav")
        cut(path, a, b, tmp)
        heard.append(norm(hear(tmp)))
        os.remove(tmp)
    n, m = len(lines), len(spans)
    NEG = -1e9
    best = [[NEG] * (m + 1) for _ in range(n + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0
    for i in range(1, n + 1):
        want = norm(lines[i - 1][1])
        for j in range(1, m + 1):
            for k in range(1, 4):
                if j - k < 0 or best[i - 1][j - k] == NEG:
                    continue
                got = " ".join(heard[j - k:j])
                sc = best[i - 1][j - k] + difflib.SequenceMatcher(None, got, want).ratio()
                if sc > best[i][j]:
                    best[i][j], back[i][j] = sc, k
    if best[n][m] == NEG:
        return None
    out, j = [], m
    for i in range(n, 0, -1):
        k = back[i][j]
        out.append((spans[j - k][0], spans[j - 1][1]))
        j -= k
    return out[::-1]


def split(group, path):
    lines = group["lines"]
    spans = None
    for gap in (0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2):
        s = speech_spans(path, gap)
        if len(s) == len(lines):
            spans = s
            break
    if not spans:
        spans = align(path, lines)
        if not spans:
            print(f"  {group['id']}: satırlar parçalara oturmadı")
            return [lid for lid, _ in lines]
    bad = []
    for (lid, text), (a, b) in zip(lines, spans):
        a = max(0.0, a - 0.05)
        b = b + 0.12
        dst = os.path.join(OUT, f"{lid}.mp3")
        wav = os.path.join(WORK, f"{lid}.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
                        "-af", "afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse", wav], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "80k", "-ac", "1", dst], check=True)
        heard = hear(wav)
        score = difflib.SequenceMatcher(None, norm(heard), norm(text)).ratio()
        mark = "ok" if score >= 0.75 else "??"
        if mark != "ok":
            bad.append(lid)
        print(f"  {mark} {lid:14} {b - a:4.2f}s  {text:34} duyulan: {heard[:40]}")
    return bad


def main():
    cfg = json.load(open(os.path.join(ROOT, "tools", "voice-lines.json")))
    want = [a for a in sys.argv[1:] if not a.startswith("--")]
    only_split = "--bol" in sys.argv
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    bad = []
    for group in cfg["groups"]:
        if want and group["id"] not in want:
            continue
        path = os.path.join(WORK, f"grup-{group['id']}.wav")
        if not only_split or not os.path.exists(path):
            print(f"{group['id']}: seslendiriliyor ({len(group['lines'])} satır)")
            generate(cfg, group, path)
        bad += split(group, path)
    print("sorunlu satırlar:", ", ".join(bad) if bad else "yok")


if __name__ == "__main__":
    main()
