package services.twocam.sportscontrol;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.graphics.Typeface;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DateFormat;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int BG = Color.rgb(9,19,33), GREEN = Color.rgb(184,239,85), MUTED = Color.rgb(165,185,208);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private SecureSession secure;
    private LanDiscovery lanDiscovery;
    private JSONObject session, snapshot;
    private LinearLayout root, screenList, score;
    private TextView status, message, title;
    private Button pointA, pointB, undo, retry;
    private EditText address;
    AlertDialog testPairDialog, testUndoDialog;
    private boolean active, connected, busy, live, pollInFlight;
    private int generation;
    private final Runnable pollTask = this::poll;
    private interface Task { String run() throws Exception; }
    private interface Result { void done(String value) throws Exception; }
    private interface ErrorHandler { void accept(Exception error); }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        secure = new SecureSession(this); lanDiscovery = new LanDiscovery(this);
        String loadError = null;
        try { String value = secure.load(); if (value != null) { session = new JSONObject(value); Endpoint.normalize(session.getString("base"), BuildConfig.DEBUG); } }
        catch (Exception e) { session = null; secure.clear(); loadError = "No se pudo recuperar el enlace cifrado. Vuelve a enlazar; el administrador puede liberar el cupo anterior."; }
        if (session != null) showLive(); else showConnect();
        if (loadError != null) message.setText(loadError);
    }
    @Override protected void onStart() { super.onStart(); active = true; if (live) poll(); }
    @Override protected void onStop() { super.onStop(); lanDiscovery.stop(); active = false; connected = false; busy = false; pollInFlight = false; generation++; handler.removeCallbacks(pollTask); if (pointA != null) buttons(); }
    @Override protected void onDestroy() { super.onDestroy(); network.shutdownNow(); handler.removeCallbacksAndMessages(null); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color); t.setPadding(0,dp(6),0,dp(6)); root.addView(t); return t;
    }
    private Button button(String label, String tag, LinearLayout parent, View.OnClickListener listener) {
        Button b = new Button(this); b.setText(label); b.setTag(tag); b.setTextColor(BG); b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(GREEN)); b.setMinHeight(dp(56));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2); p.setMargins(0,dp(8),0,dp(8)); parent.addView(b,p); b.setOnClickListener(listener); return b;
    }
    private EditText input(String hint, String tag, LinearLayout parent) {
        EditText e = new EditText(this); e.setHint(hint); e.setTag(tag); e.setTextColor(Color.WHITE); e.setHintTextColor(MUTED); e.setSingleLine(true); e.setMinHeight(dp(56)); parent.addView(e,new LinearLayout.LayoutParams(-1,-2)); return e;
    }
    private void layout(String heading) {
        generation++; handler.removeCallbacks(pollTask); busy = false; pollInFlight = false; connected = false; snapshot = null;
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(BG);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(22),dp(24),dp(22),dp(24)); scroll.addView(root); setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v, insets) -> { root.setPadding(dp(22)+insets.getSystemWindowInsetLeft(),dp(16)+insets.getSystemWindowInsetTop(),dp(22)+insets.getSystemWindowInsetRight(),dp(16)+insets.getSystemWindowInsetBottom()); return insets; });
        text("2CAM SPORTS · CONTROL",14,GREEN); title = text(heading,30,Color.WHITE); title.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
        status = text("",14,MUTED); status.setTag("connection"); message = text("",15,Color.rgb(255,195,120)); message.setTag("message");
    }
    private void work(Task task, Result result, ErrorHandler error) {
        final int version = generation;
        network.execute(() -> { try { String value = task.run(); handler.post(() -> { if (isFinishing() || version != generation || !active) return; try { result.done(value); } catch (Exception e) { error.accept(e); } }); }
            catch (Exception e) { handler.post(() -> { if (!isFinishing() && version == generation && active) error.accept(e); }); } });
    }
    private String readable(Exception e) { return e instanceof ApiClient.Failure ? e.getMessage() : "No se pudo conectar. Revisa el Wi-Fi, la dirección y que Sports siga abierto en el Fire."; }
    private void showConnect() {
        live = false; layout("Conecta con tu sede");
        text("Busca tu Fire en Wi-Fi o introduce la dirección que muestra su pantalla Sports. Ambos deben estar en la misma red.",16,MUTED);
        address = input("http://192.168.1.20:8787","serverAddress",root); address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        String last = getPreferences(MODE_PRIVATE).getString("lastAddress", ""); address.setText(last);
        button("Buscar pantallas en la dirección indicada","discover",root,v -> discover());
        button("Buscar Fire TV en Wi-Fi","discoverLan",root,v -> { status.setText("Buscando pantallas Sports activas en la red…"); screenList.removeAllViews(); lanDiscovery.start((name,base) -> { if(!active||live)return; button(name,"lan-"+name,screenList,b -> { address.setText(base); lanDiscovery.stop(); discover(); }); }, error -> { if(active&&!live)status.setText(error); }); });
        screenList = new LinearLayout(this); screenList.setOrientation(LinearLayout.VERTICAL); root.addView(screenList);
        text("0.3.0 · APK de prueba · Android 6 o superior\nEste control utiliza el servicio local Sports. Se conecta directamente con el modo Sports local de Digital Signage en el Fire. No necesita computadora.",13,MUTED);
    }
    private void discover() {
        final String base;
        try { base = Endpoint.normalize(address.getText().toString(),BuildConfig.DEBUG); } catch (Exception e) { message.setText(e.getMessage()); return; }
        status.setText("Buscando pantallas registradas…"); message.setText(""); screenList.removeAllViews();
        work(() -> ApiClient.request(base,"/discovery",null,null,null), raw -> {
            JSONArray list = new JSONArray(raw); status.setText(list.length() == 0 ? "No hay pantallas Sports registradas en este servicio." : "Selecciona una pantalla");
            getPreferences(MODE_PRIVATE).edit().putString("lastAddress",base).apply();
            for(int i=0;i<list.length();i++) { JSONObject s=list.getJSONObject(i); if(!"sports".equals(s.optString("mode"))) continue;
                Button b = button(s.getString("name") + " · " + s.getInt("slotsUsed") + "/3 controles", "screen-"+s.getString("id"), screenList, v -> pairDialog(base,s)); b.setEnabled(s.getInt("slotsUsed")<3);
            }
        }, e -> { status.setText("Sin conexión"); message.setText(readable(e)); });
    }
    private void pairDialog(String base, JSONObject screen) {
        LinearLayout fields = new LinearLayout(this); fields.setOrientation(LinearLayout.VERTICAL); fields.setPadding(dp(20),0,dp(20),0);
        EditText name = input("Nombre de esta tablet / teléfono","deviceName",fields), code = input("Código de 6 dígitos de la pantalla","pairCode",fields); code.setInputType(InputType.TYPE_CLASS_NUMBER);
        TextView errorText = new TextView(this); errorText.setTextColor(Color.rgb(255,195,120)); fields.addView(errorText);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Enlazar: "+screen.optString("name")).setView(fields).setNegativeButton("Cancelar",null).setPositiveButton("Enlazar",null).create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String deviceName=name.getText().toString().trim(), pin=code.getText().toString().trim();
            if(deviceName.isEmpty() || deviceName.length()>100 || !pin.matches("[0-9]{6}")) { errorText.setText("Indica un nombre y el código de seis dígitos."); return; }
            Button ok=dialog.getButton(AlertDialog.BUTTON_POSITIVE); ok.setEnabled(false);
            work(() -> ApiClient.request(base,"/screens/"+screen.getString("id")+"/pair",null,new JSONObject().put("name",deviceName).put("code",pin),null), raw -> {
                JSONObject reply = new JSONObject(raw);
                JSONObject binding=new JSONObject().put("base",base).put("screenId",screen.getString("id")).put("token",reply.getString("controlToken"));
                try { secure.save(binding.toString()); } catch(Exception e) { errorText.setText("El servidor aceptó el enlace, pero no se pudo guardar. Pide al administrador desvincular este control y vuelve a intentarlo."); ok.setEnabled(false); return; }
                session=binding; dialog.dismiss(); showLive(); if(active) poll();
            }, e -> { ok.setEnabled(true); errorText.setText(readable(e)+" Si hubo una respuesta perdida, revisa los cupos antes de repetir."); });
        })); testPairDialog=dialog; dialog.show();
    }
    private void showLive() {
        live = true; layout("Marcador"); getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        status.setText("Conectando…"); score=new LinearLayout(this); score.setOrientation(LinearLayout.VERTICAL); root.addView(score);
        pointA=button("Punto A","pointA",root,v -> command("point",0)); pointB=button("Punto B","pointB",root,v -> command("point",1));
        undo=button("Deshacer último punto","undo",root,v -> { testUndoDialog = new AlertDialog.Builder(this).setTitle("Corregir marcador").setMessage("¿Deshacer el último punto confirmado?").setNegativeButton("Cancelar",null).setPositiveButton("Deshacer",(d,w)->command("undo",null)).create(); testUndoDialog.show(); });
        retry=button("Verificar operación pendiente","retry",root,v -> sendPending()); retry.setVisibility(View.GONE);
        button("Reconectar ahora","reconnect",root,v -> { handler.removeCallbacks(pollTask); if(!busy)poll(); });
        button("Olvidar enlace en este dispositivo","forget",root,v -> new AlertDialog.Builder(this).setTitle("Olvidar enlace").setMessage("El administrador deberá desvincular el control para liberar su cupo. No se borrará ninguna operación del servidor.").setNegativeButton("Cancelar",null).setPositiveButton("Olvidar",(d,w)->{secure.clear();session=null;getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);showConnect();}).show());
        buttons();
    }
    private String screenPath() { return "/screens/"+session.optString("screenId"); }
    private void poll() {
        if(!active || !live || session==null || busy || pollInFlight)return;
        pollInFlight=true;
        handler.removeCallbacks(pollTask);
        final String base=session.optString("base"), token=session.optString("token"), path=screenPath();
        work(() -> ApiClient.request(base,path+"/snapshot",token,null,null),raw -> {
            pollInFlight=false; snapshot=new JSONObject(raw); connected=true; render(); handler.postDelayed(pollTask,800);
        },e -> {pollInFlight=false;connected=false;status.setText(e instanceof ApiClient.Failure && ((ApiClient.Failure)e).status==401 ? "Enlace revocado o no autorizado" : "Desconectado · último estado recibido");score.setAlpha(.45f);buttons();handler.postDelayed(pollTask,2000);});
    }
    private void render() throws Exception {
        JSONObject m=snapshot.getJSONObject("match"), state=m.getJSONObject("state"); JSONArray names=m.getJSONArray("names"), labels=m.getJSONArray("labels"), games=state.getJSONArray("games"), sets=state.getJSONArray("setsWon"), history=state.getJSONArray("completedSets");
        score.setAlpha(1f); score.removeAllViews(); title.setText(snapshot.getJSONObject("screen").getString("name"));
        status.setText("Conectado · "+DateFormat.getTimeInstance().format(new Date())+" · versión "+m.getInt("version"));
        for(int side=0;side<2;side++) {
            LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(16),dp(12),dp(16),dp(12));card.setBackgroundColor(Color.rgb(20,36,57));
            LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,-2);cp.setMargins(0,dp(6),0,dp(6));score.addView(card,cp);
            TextView name=new TextView(this);name.setText((state.optInt("server")==side && state.isNull("winner") ? "● " : "")+names.getString(side));name.setTextColor(Color.WHITE);name.setTextSize(22);card.addView(name);
            TextView value=new TextView(this);value.setText(labels.getString(side));value.setTextSize(54);value.setTypeface(Typeface.DEFAULT,Typeface.BOLD);value.setTextColor(GREEN);value.setTag(side==0?"scoreA":"scoreB");card.addView(value);
            StringBuilder detail=new StringBuilder("Games: "+games.getInt(side)+"   Sets: "+sets.getInt(side));
            for(int i=0;i<history.length();i++){JSONObject s=history.getJSONObject(i);boolean mt="match_tiebreak".equals(s.getString("kind"));detail.append("   ").append(mt?"[":"").append(s.getJSONArray(mt?"tiePoints":"games").getInt(side)).append(mt?"]":"");}
            TextView info=new TextView(this);info.setText(detail.toString());info.setTextColor(MUTED);info.setTextSize(16);card.addView(info);
        }
        pointA.setText("Punto · "+names.getString(0));pointB.setText("Punto · "+names.getString(1));
        String phase=state.getString("phase");
        if("finished".equals(phase))message.setText("Ganador: "+names.getString(state.getInt("winner")));
        else if(session.has("pending"))message.setText("Hay una operación sin confirmar. Verifícala antes de sumar otro punto.");
        else if(snapshot.optBoolean("decidingPoint"))message.setText("PUNTO DECISIVO");
        else if(phase.contains("tiebreak"))message.setText("match_tiebreak".equals(phase)?"SUPERTIEBREAK":"TIEBREAK");
        buttons();
    }
    private void buttons() {
        if(pointA==null)return;
        String role=snapshot==null?"":snapshot.optString("role");boolean official="official".equals(role), pending=session!=null&&session.has("pending");
        boolean enabled=connected&&!busy&&!pending&&snapshot!=null&&"live".equals(snapshot.optJSONObject("match").optString("status"));
        pointA.setVisibility(official||"home".equals(role)?View.VISIBLE:View.GONE);pointB.setVisibility(official||"away".equals(role)?View.VISIBLE:View.GONE);
        pointA.setEnabled(enabled);pointB.setEnabled(enabled);undo.setVisibility(official?View.VISIBLE:View.GONE);
        undo.setEnabled(connected&&!busy&&!pending&&snapshot!=null&&snapshot.optJSONObject("match").optInt("version")>1);
        retry.setVisibility(pending?View.VISIBLE:View.GONE);retry.setEnabled(connected&&!busy&&pending);
    }
    private void command(String type,Integer side) {
        if(!connected||busy||session.has("pending")||snapshot==null)return;
        try {
            JSONObject body=new JSONObject().put("type",type).put("expectedVersion",snapshot.getJSONObject("match").getInt("version"));if(side!=null)body.put("side",side);
            session.put("pending",new JSONObject().put("key",UUID.randomUUID().toString()).put("body",body));secure.save(session.toString());sendPending();
        }catch(Exception e){session.remove("pending");message.setText("No se envió el punto: no se pudo guardar la operación pendiente.");buttons();}
    }
    private void clearPending() throws Exception {session.remove("pending");secure.save(session.toString());}
    private void sendPending() {
        if(!active||!connected||busy||session==null||!session.has("pending"))return;
        busy=true;buttons();handler.removeCallbacks(pollTask);
        final String base=session.optString("base"), token=session.optString("token"),path=screenPath();final JSONObject pending=session.optJSONObject("pending");
        work(() -> ApiClient.request(base,path+"/commands",token,pending.getJSONObject("body"),pending.getString("key")),raw->{clearPending();busy=false;message.setText("Operación confirmada");poll();},e->{
            busy=false;
            if(e instanceof ApiClient.Failure&&(((ApiClient.Failure)e).status==409||((ApiClient.Failure)e).status==403||((ApiClient.Failure)e).status==422)){try{clearPending();}catch(Exception ignored){}message.setText(e.getMessage()+" Esta operación no se aplicó.");}
            else message.setText("No se recibió confirmación. Actualiza y pulsa Verificar operación pendiente; se reutilizará su identificador para no duplicarla.");
            connected=false;buttons();poll();
        });
    }
}
