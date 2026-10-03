import asyncio
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
if sys.argv[1] == 'tts':
    import edge_tts
    asyncio.run(edge_tts.Communicate(sys.stdin.read(), 'zh-CN-XiaoxiaoNeural').save(sys.argv[2]))
    print(json.dumps({'ok': True}))
else:
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    audio = decode_audio(sys.argv[2], sampling_rate=16000)
    if len(audio) > 16000 * 21:
        raise ValueError('Nagranie jest za długie. Maksymalnie 20 sekund.')
    model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
    segments, info = model.transcribe(audio, language='zh', beam_size=5,
        vad_filter=True, vad_parameters={'min_silence_duration_ms': 400},
        condition_on_previous_text=False, word_timestamps=True)
    output = []
    for segment in segments:
        if segment.no_speech_prob > .7:
            continue
        output.append({'text': segment.text, 'start': segment.start, 'end': segment.end})
    print(json.dumps({'text': ''.join(s['text'] for s in output).strip(), 'segments': output}, ensure_ascii=False))
