"""One-time creation of bundled Mandarin examples; not needed to run the app."""
import asyncio
from pathlib import Path
import edge_tts

async def main():
    folder = Path(__file__).resolve().parents[1] / 'public' / 'audio'
    folder.mkdir(exist_ok=True)
    for name, text in [('ma1', '妈'), ('ma2', '麻'), ('ma3', '马'), ('ma4', '骂'), ('yi1', '衣'), ('yu2', '鱼'), ('ni3', '你'), ('shi4', '是')]:
        await edge_tts.Communicate(text, 'zh-CN-XiaoxiaoNeural', rate='-20%').save(str(folder / f'{name}.mp3'))
        print(name, (folder / f'{name}.mp3').stat().st_size)

asyncio.run(main())
