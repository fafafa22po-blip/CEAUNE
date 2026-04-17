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

@CapacitorPlugin(name = "DocumentScanner")
public class DocumentScannerPlugin extends Plugin {

    private static final int REQUEST_CODE = 21232;
    private PluginCall savedCall;

    @PluginMethod
    public void scan(PluginCall call) {
        savedCall = call;

        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(true)
                .setPageLimit(20)
                .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_PDF)
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
        if (requestCode != REQUEST_CODE || savedCall == null) return;

        PluginCall call = savedCall;
        savedCall = null;

        if (resultCode == Activity.RESULT_OK) {
            GmsDocumentScanningResult result = GmsDocumentScanningResult.fromActivityResultIntent(data);
            if (result != null && result.getPdf() != null) {
                try {
                    InputStream is = getContext().getContentResolver().openInputStream(result.getPdf().getUri());
                    byte[] bytes = streamToBytes(is);
                    is.close();
                    String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                    JSObject ret = new JSObject();
                    ret.put("base64", base64);
                    ret.put("mimeType", "application/pdf");
                    ret.put("name", "documento_escaneado.pdf");
                    ret.put("pageCount", result.getPdf().getPageCount());
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Error al procesar PDF: " + e.getMessage());
                }
            } else {
                call.reject("No se obtuvo resultado del escáner");
            }
        } else if (resultCode == Activity.RESULT_CANCELED) {
            call.reject("Cancelado", "CANCELLED");
        } else {
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
