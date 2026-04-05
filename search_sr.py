import re

content = open(r'D:\代码仓库\Oo-s-project\script.js', encoding='utf-8').read()
matches = [(i+1, line) for i, line in enumerate(content.split('\n')) if re.search(r'\u652f\u6491\u4f4d|\u538b\u529b\u4f4d|support|resistance|fibonacci|donchian|atr|brackets', line, re.IGNORECASE)]
for ln, line in matches[:20]:
    print(f'{ln}: {line.rstrip()}')
