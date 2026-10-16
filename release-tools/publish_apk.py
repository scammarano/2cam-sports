"""Publish an already CI-tested APK without recompiling or replacing its signer."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

root=Path(__file__).resolve().parents[1]
assets=root/'.release-assets'
raw=(assets/'manifest.json').read_bytes()
sig=(assets/'manifest.sig').read_bytes()
manifest=json.loads(raw)
repo=os.environ['GH_REPO']
assert repo=='scammarano/2cam-sports'
assert manifest['source_commit']=='e59b4141046f7a6b35a25bfa26c28097fe209751'
run=json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/actions/runs/{manifest["source_workflow_run"]}'],text=True))
assert run['conclusion']=='success' and run['head_sha']==manifest['source_commit']
pub=assets/'update-public.txt'
der=subprocess.check_output(['openssl','pkey','-pubin','-in',str(pub),'-outform','DER'])
assert hashlib.sha256(der).hexdigest()=='1c6623f7cd4ed5b1c18b7f3254e6e050a39c6bea8f2d7cd9faaecc56287a10f4'
with tempfile.TemporaryDirectory() as work:
    out=Path(work)
    (out/'manifest.json').write_bytes(raw)
    (out/'signature').write_bytes(base64.b64decode(sig))
    subprocess.run(['openssl','dgst','-sha256','-verify',str(pub),'-signature',str(out/'signature'),str(out/'manifest.json')],check=True)
    data=base64.b64decode((assets/'app.b64').read_text().strip(),validate=True)
    assert len(data)==manifest['size'] and hashlib.sha256(data).hexdigest()==manifest['sha256']
    apk=out/'2Cam_Sports_Control_v0.3.0_TEST.apk';apk.write_bytes(data)
    tools=Path(os.environ['ANDROID_HOME'])/'build-tools/35.0.0'
    proof=subprocess.check_output([str(tools/'apksigner'),'verify','--verbose','--print-certs','--min-sdk-version','23',str(apk)],text=True)
    certs=re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})',proof)
    assert certs==[manifest['certificate_sha256']]==['7bd01e3921783cbbad9e09214d2857a75208a71c56215c219217c101829af7e0']
    badging=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(apk)],text=True)
    identity=re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'",badging)
    sdk=re.search(r"sdkVersion:'(\d+)'",badging)
    assert identity and identity[1]==manifest['package']=='services.twocam.sportscontrol'
    assert identity[2]=='3' and identity[3]==manifest['version_name']=='0.3.0-test' and sdk and sdk[1]=='23'
    assert manifest['platform']=='sports-control' and manifest['channel']=='debug'
    envelope=out/'2CAM_APK_sports-control_v0.3.0-test_RSA.zip'
    with zipfile.ZipFile(envelope,'w') as z:
        for name,b in [('manifest.json',raw),('manifest.sig',sig),('app.apk',data)]:z.writestr(zipfile.ZipInfo(name),b)
    sums=out/'SHA256SUMS.txt';sums.write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in [apk,envelope]))
    notes=out/'RELEASE_NOTES.md'
    notes.write_text('2Cam Sports Control 0.3.0 de pruebas. Control para teléfono/tablet Android 6+ (API23); el marcador se ejecuta en Digital Signage del Fire TV. LAN directa, sin PC.\n\nFuente probada: '+manifest['source_commit']+'; CI '+str(manifest['source_workflow_run'])+'. Se conserva exactamente el APK y el certificado de esa compilación; no se recompila ni se cambia de firma. SHA-256: '+manifest['sha256']+'.\n\nImportador del portal: plataforma sports-control, paquete services.twocam.sportscontrol, certificado SHA-256 '+manifest['certificate_sha256']+'. Usar Público sin token e importar el sobre RSA a Pruebas. Promoción a Estable solo manual.\n\nLa app no incorpora aún búsqueda de actualizaciones desde el portal. La clave debug original no está aprovisionada como secreto de firma permanente; próximas compilaciones deben verificar continuidad antes de actualizar. Pruebas físicas de multicast y latencia pendientes. No instalar esta APK en Fire OS5/API22. Ningún hosting/dispositivo se modifica automáticamente.')
    tag='sports-control-v0.3.0-test';files=[apk,envelope,sums]
    existing=subprocess.run(['gh','api',f'repos/{repo}/releases/tags/{tag}'],capture_output=True,text=True)
    if existing.returncode:
        subprocess.run(['gh','release','create',tag,*map(str,files),'--prerelease','--target',manifest['source_commit'],'--title','2Cam Sports Control 0.3.0 · Pruebas','--notes-file',str(notes)],check=True)
    else:
        published={a['name']:a for a in json.loads(existing.stdout)['assets']}
        for file in files:
            if file.name in published:
                actual=json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/releases/assets/{published[file.name]["id"]}'],text=True))['digest']
                assert actual=='sha256:'+hashlib.sha256(file.read_bytes()).hexdigest(),'Refusing to replace a different existing release asset'
            else:subprocess.run(['gh','release','upload',tag,str(file)],check=True)
    print('SPORTS_RELEASE_VERIFIED_PUBLISHED',tag,manifest['sha256'],certs[0])
