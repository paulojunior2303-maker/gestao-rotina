"""Gera dist/gestao-rotina.html: um único arquivo com CSS e JS embutidos (abre com duplo clique)."""
import re, base64, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/styles.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="css/styles.css">', f'<style>\n{css}\n</style>')
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
icon = base64.b64encode((root / 'icon.svg').read_bytes()).decode()
html = html.replace('href="icon.svg"', f'href="data:image/svg+xml;base64,{icon}"')
def inline(m):
    js = (root / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script')
    return f'<script>/* {m.group(1)} */\n{js}\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/gestao-rotina.html').write_text(html, encoding='utf-8')
print('dist/gestao-rotina.html', len(html) // 1024, 'KB')
