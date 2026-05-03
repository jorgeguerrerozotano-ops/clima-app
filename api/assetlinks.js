export default function handler(req, res) {
    const googleConfig =
        // --- PEGA TU CÓDIGO JUSTO DEBAJO DE ESTA LÍNEA ---
        [
            {
                "relation": [
                    "delegate_permission/common.handle_all_urls"
                ],
                "target": {
                    "namespace": "android_app",
                    "package_name": "app.vercel.clima_app_murex.twa",
                    "sha256_cert_fingerprints": [
                        "81:00:3D:D7:76:B6:5E:B6:E1:AB:0D:02:EE:68:CC:9A:00:B8:7F:88:A5:BB:70:2F:91:2A:E8:97:85:56:22:4E"
                    ]
                }
            }
        ]
        // --- PEGA TU CÓDIGO JUSTO ENCIMA DE ESTA LÍNEA ---
        ;

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(googleConfig);
}