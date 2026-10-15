package services.twocam.sportscontrol;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.TextView;
import org.json.JSONObject;

/** Prueba real en emulador: UI nativa → API → persistencia de enlace → corrección. */
public class SmokeInstrumentation extends Instrumentation {
    private MainActivity activity;
    private final String base="http://10.0.2.2:8787",admin="emulator-test-only-admin-key-123456";
    @Override public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
    @Override public void onStart(){Bundle result=new Bundle();try{exercise();result.putString("stream","SPORTS_ANDROID_SMOKE_PASS\n");finish(Activity.RESULT_OK,result);}catch(Throwable e){result.putString("stream","SPORTS_ANDROID_SMOKE_FAIL: "+e.getClass().getSimpleName()+" "+e.getMessage()+"\n");finish(Activity.RESULT_CANCELED,result);}}
    private View find(View v,String tag){if(tag.equals(v.getTag()))return v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){View found=find(g.getChildAt(i),tag);if(found!=null)return found;}}return null;}
    private View view(String tag){return find(activity.getWindow().getDecorView(),tag);}
    private void waitFor(String tag,String contains) throws Exception{long end=System.currentTimeMillis()+15000;while(System.currentTimeMillis()<end){final boolean[] ok={false};runOnMainSync(()->{View v=view(tag);ok[0]=v!=null&&(contains==null||(v instanceof TextView&&((TextView)v).getText().toString().contains(contains)));});if(ok[0])return;Thread.sleep(100);}throw new AssertionError("No apareció "+tag+" / "+contains);}
    private void click(String tag){runOnMainSync(()->{View v=view(tag);if(v==null||!v.isEnabled())throw new AssertionError("Botón no disponible: "+tag);v.performClick();});}
    private JSONObject post(String path,JSONObject body)throws Exception{return new JSONObject(ApiClient.request(base,path,admin,body,null));}
    private void exercise()throws Exception{
        if(!Endpoint.normalize("192.168.1.4:8787/",true).equals("http://192.168.1.4:8787"))throw new AssertionError("Normalización");
        try{Endpoint.normalize("http://example.com",true);throw new AssertionError("HTTP público permitido");}catch(IllegalArgumentException expected){}
        try{Endpoint.normalize("http://192.168.1.1",false);throw new AssertionError("HTTP release permitido");}catch(IllegalArgumentException expected){}
        JSONObject court=post("/courts",new JSONObject().put("name","Pista emulador"));
        JSONObject set=new JSONObject().put("kind","games").put("games",6).put("tiebreakAt",6).put("tiebreakPoints",7);
        JSONObject format=new JSONObject().put("discipline","padel").put("bestOf",3).put("deuce","star").put("set",set).put("decidingSet",set);
        JSONObject match=post("/matches",new JSONObject().put("courtId",court.getString("id")).put("names",new org.json.JSONArray().put("Verde").put("Azul")).put("format",format));
        post("/matches/"+match.getString("id")+"/start",new JSONObject());
        JSONObject screen=post("/screens",new JSONObject().put("name","TV prueba Android").put("matchId",match.getString("id")));
        String code=post("/screens/"+screen.getString("id")+"/pairing",new JSONObject().put("role","official")).getString("code");
        activity=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        waitFor("serverAddress",null);runOnMainSync(()->((EditText)view("serverAddress")).setText(base));click("discover");waitFor("screen-"+screen.getString("id"),null);click("screen-"+screen.getString("id"));
        waitForIdleSync();
        // El diálogo vive en otra ventana: se consulta el diálogo activo por la actividad.
        runOnMainSync(()->{
            android.app.AlertDialog d=activity.testPairDialog;
            if(d==null)throw new AssertionError("No abrió enlace");
            ((EditText)find(d.getWindow().getDecorView(),"deviceName")).setText("Tablet emulador");
            ((EditText)find(d.getWindow().getDecorView(),"pairCode")).setText(code);
            d.getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick();
        });
        waitFor("connection","Conectado");waitFor("scoreA","0");click("pointA");waitFor("scoreA","15");
        // Salir y abrir de nuevo fuerza lectura del token cifrado en AndroidKeyStore.
        runOnMainSync(()->activity.finish());waitForIdleSync();
        activity=(MainActivity)startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitFor("connection","Conectado");waitFor("scoreA","15");
        click("undo");waitForIdleSync();runOnMainSync(()->{if(activity.testUndoDialog==null)throw new AssertionError("Confirmación de corrección");activity.testUndoDialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick();});waitFor("scoreA","0");
        String raw=ApiClient.request(base,"/screens/"+screen.getString("id")+"/snapshot",screen.getString("displayToken"),null,null);
        if(new JSONObject(raw).getJSONObject("match").getInt("version")!=3)throw new AssertionError("Versión esperada tras punto y undo");
        new SecureSession(getTargetContext()).clear();runOnMainSync(()->activity.finish());
    }
}
