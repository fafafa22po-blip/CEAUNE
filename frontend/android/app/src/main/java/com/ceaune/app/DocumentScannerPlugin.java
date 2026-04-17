package com.ceaune.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;

@CapacitorPlugin(name = "DocumentScanner")
public class DocumentScannerPlugin extends Plugin {

    private static final int REQUEST_CODE = 21232;
    private PluginCall savedCall;
    // Guardamos el callbackId para recuperar el call si Android recrea la Activity
    private String savedCallbackId;

    @PluginMethod
    public void scan(PluginCall call) {
        // setKeepAlive evita que Capacitor libere el call mientras el escáner está abierto
        call.setKeepAlive(true);
        savedCall = call;
        savedCallbackId = call.getCallbackId();

        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(true)
                .setPageLimit(20)
                .setResultFormats(
                        GmsDocumentScannerOptions.RESULT_FORMAT_JPEG,
                        GmsDocumentScannerOptions.RESULT_FORMAT_PDF)
                .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                .build();

        GmsDocumentScanning.getClient(options)
                .getStartScanIntent(getActivity())
                .addOnSuccessListener(intentSender -> {
                    try {
                        getActivity().startIntentSenderForResult(
                                intentSender, REQUEST_CODE, null, 0, 0, 0
                        );
                    } catch (Exception e) {
                        call.reject("No se pudo iniciar el escáner: " + e.getMessage());
                    }
                })
                .addOnFailureListener(e -> call.reject("Error al preparar escáner: " + e.getMessage()));
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_CODE) return;

        // Recuperar el call: puede haberse perdido si Android recreó la Activity
        PluginCall call = savedCall;
        if (call == null && savedCallbackId != null) {
            call = bridge.getSavedCall(savedCallbackId);
        }
        if (call == null) return;

        savedCall = null;
        savedCallbackId = null;

        if (resultCode == Activity.RESULT_OK) {
            GmsDocumentScanningResult result = GmsDocumentScanningResult.fromActivityResultIntent(data);
            if (result == null) { call.setKeepAlive(false); call.reject("No se obtuvo resultado del escáner"); return; }

            try {
                List<GmsDocumentScanningResult.Page> pages = result.getPages();

                // 1 página → devolver JPEG (mayor calidad que PDF embebido)
                if (pages != null && pages.size() == 1) {
                    InputStream is = getContext().getContentResolver()
                            .openInputStream(pages.get(0).getImageUri());
                    byte[] bytes = streamToBytes(is);
                    is.close();
                    String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                    JSObject ret = new JSObject();
                    ret.put("base64", base64);
                    ret.put("mimeType", "image/jpeg");
                    ret.put("name", "documento_escaneado.jpg");
                    ret.put("pageCount", 1);
                    call.setKeepAlive(false);
                    call.resolve(ret);

                // Varias páginas → PDF
                } else if (result.getPdf() != null) {
                    InputStream is = getContext().getContentResolver()
                            .openInputStream(result.getPdf().getUri());
                    byte[] bytes = streamToBytes(is);
                    is.close();
                    String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                    JSObject ret = new JSObject();
                    ret.put("base64", base64);
                    ret.put("mimeType", "application/pdf");
                    ret.put("name", "documento_escaneado.pdf");
                    ret.put("pageCount", result.getPdf().getPageCount());
                    call.setKeepAlive(false);
                    call.resolve(ret);

                } else {
                    call.setKeepAlive(false);
                    call.reject("No se obtuvo resultado del escáner");
                }
            } catch (Exception e) {
                call.setKeepAlive(false);
                call.reject("Error al procesar documento: " + e.getMessage());
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            call.setKeepAlive(false);
            call.reject("Cancelado", "CANCELLED");
        } else {
            call.setKeepAlive(false);
            call.reject("Error en el escáner");
        }
    }

    private byte[] streamToBytes(InputStream is) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[16384];
        int nRead;
        while ((nRead = is.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, nRead);
        }
        return buffer.toByteArray();
    }
}
