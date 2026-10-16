package services.twocam.sportscontrol;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;
import java.net.Inet4Address;
import java.util.ArrayDeque;
import java.util.HashSet;

/** Descubre únicamente receptores Sports anunciados por las pantallas activas. */
final class LanDiscovery {
    interface Found { void accept(String name,String address); }
    interface Problem { void accept(String message); }
    private final NsdManager manager;private final Handler main=new Handler(Looper.getMainLooper());
    private NsdManager.DiscoveryListener listener;private final ArrayDeque<NsdServiceInfo> queue=new ArrayDeque<>();private final HashSet<String> seen=new HashSet<>();private boolean resolving,running;private int epoch;
    LanDiscovery(Context c){manager=(NsdManager)c.getApplicationContext().getSystemService(Context.NSD_SERVICE);}
    void start(Found found,Problem problem){stop();if(manager==null){problem.accept("Búsqueda no disponible. Introduce la dirección que muestra el Fire.");return;}running=true;final int activeEpoch=++epoch;
        listener=new NsdManager.DiscoveryListener(){
            public void onDiscoveryStarted(String type){}
            public void onDiscoveryStopped(String type){}
            public void onServiceLost(NsdServiceInfo info){}
            public void onStopDiscoveryFailed(String type,int code){}
            public void onStartDiscoveryFailed(String type,int code){main.post(()->{if(running&&epoch==activeEpoch){stop();problem.accept("No se pudo buscar. Introduce la dirección del Fire.");}});}
            public void onServiceFound(NsdServiceInfo info){main.post(()->{if(!running||epoch!=activeEpoch||!info.getServiceType().contains("_2cam-sports._tcp")||!seen.add(info.getServiceName()))return;queue.add(info);resolve(activeEpoch,found,problem);});}
        };
        try{manager.discoverServices("_2cam-sports._tcp.",NsdManager.PROTOCOL_DNS_SD,listener);}catch(Exception e){stop();problem.accept("No se pudo iniciar búsqueda. Usa la dirección del Fire.");}
        main.postDelayed(()->{if(running&&epoch==activeEpoch){stop();problem.accept("Búsqueda terminada. Si no aparece tu Fire, introduce su dirección manualmente.");}},12000);
    }
    private void resolve(int activeEpoch,Found found,Problem problem){if(resolving||queue.isEmpty()||!running||activeEpoch!=epoch)return;resolving=true;NsdServiceInfo next=queue.remove();
        try{manager.resolveService(next,new NsdManager.ResolveListener(){
            public void onResolveFailed(NsdServiceInfo info,int code){main.post(()->{if(epoch!=activeEpoch)return;resolving=false;resolve(activeEpoch,found,problem);});}
            public void onServiceResolved(NsdServiceInfo info){main.post(()->{if(epoch!=activeEpoch||!running)return;resolving=false;if(info.getHost() instanceof Inet4Address&&info.getHost().isSiteLocalAddress()){String address="http://"+info.getHost().getHostAddress()+":"+info.getPort();found.accept(info.getServiceName(),address);}resolve(activeEpoch,found,problem);});}
        });}catch(Exception e){resolving=false;resolve(activeEpoch,found,problem);}
    }
    void stop(){running=false;epoch++;if(listener!=null&&manager!=null)try{manager.stopServiceDiscovery(listener);}catch(Exception ignored){}listener=null;queue.clear();seen.clear();resolving=false;}
}
