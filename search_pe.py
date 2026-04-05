import re

content = open(r'D:\代码仓库\Oo-s-project\script.js', encoding='utf-8').read()
matches = [(i+1, line) for i, line in enumerate(content.split('\n')) if re.search(r'\bpe\b|peRatio|市盈率', line)]
for ln, line in matches[:20]:
    print(f'{ln}: {line.rstrip()}')
