import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';

/**
 * Página de Política de Privacidad (GDPR/CCPA).
 * Accesible en /privacy para PWA/TWA y requisitos de Google Play.
 */
function PrivacyView() {
  const handleBackHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-surface-body text-slate-100 flex flex-col">
      <header className="shrink-0 border-b border-border-default/50 bg-surface-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-4 max-w-3xl mx-auto">
          <h1 className="text-lg font-bold text-primary-light">
            Política de Privacidad
          </h1>
          <p className="text-xs text-muted mt-0.5">
            [ELIO Weather & Routes]
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto user-select-text px-4 py-6 pb-10 max-w-3xl mx-auto w-full">
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-slate-200">
          {/* Introducción */}
          <section>
            <h2 className="text-base font-bold text-slate-100 mb-2">
              1. Introducción
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Esta aplicación es una <strong>extensión de la experiencia web</strong> de
              [ELIO Weather & Routes]. Funciona como PWA (Progressive Web App) y, cuando
              se instala desde Google Play, como TWA (Trusted Web Activity). El mismo
              servicio y la misma política de privacidad se aplican tanto en la web como
              en la app instalada.
            </p>
          </section>

          {/* Datos recopilados */}
          <section>
            <h2 className="text-base font-bold text-slate-100 mb-2">
              2. Datos recopilados
            </h2>
            <p className="text-sm leading-relaxed text-slate-300 mb-2">
              Para el funcionamiento del servicio y el cumplimiento legal podemos recopilar,
              entre otros, los siguientes tipos de datos:
            </p>
            <ul className="list-disc pl-5 text-sm leading-relaxed text-slate-300 space-y-1">
              <li><strong>Cookies y tecnologías similares:</strong> para preferencias, sesión y análisis de uso.</li>
              <li><strong>Dirección IP:</strong> registrada en los logs del servidor (plataforma de alojamiento) para seguridad y diagnóstico.</li>
              <li><strong>Datos del dispositivo:</strong> tipo de dispositivo, sistema operativo, idioma y datos técnicos necesarios para ofrecer la experiencia (por ejemplo, ubicación si la autorizas para el tiempo y las rutas).</li>
            </ul>
          </section>

          {/* Servicios de terceros */}
          <section>
            <h2 className="text-base font-bold text-slate-100 mb-2">
              3. Servicios de terceros
            </h2>
            <p className="text-sm leading-relaxed text-slate-300 mb-2">
              La aplicación y el sitio web utilizan infraestructura y servicios de terceros.
              Sus políticas de privacidad se aplican a los datos que ellos procesan:
            </p>
            <ul className="list-disc pl-5 text-sm leading-relaxed text-slate-300 space-y-1">
              <li>
                <strong>Google Play Services</strong> (cuando usas la app desde Google Play):{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-light underline hover:text-primary"
                >
                  Política de privacidad de Google
                </a>
              </li>
              <li>
                <strong>Vercel</strong> (alojamiento del sitio/app):{' '}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-light underline hover:text-primary"
                >
                  Política de privacidad de Vercel
                </a>
              </li>
            </ul>
          </section>

          {/* Seguridad */}
          <section>
            <h2 className="text-base font-bold text-slate-100 mb-2">
              4. Seguridad
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Protegemos los datos mediante <strong>comunicación cifrada (SSL/HTTPS)</strong> en
              todo el tráfico entre tu dispositivo y nuestros servidores. Aplicamos medidas
              técnicas y organizativas razonables para reducir riesgos de acceso no autorizado,
              pérdida o alteración de datos. Ningún sistema es infalible; te recomendamos
              no compartir datos sensibles más allá de lo necesario para usar el servicio.
            </p>
          </section>

          {/* Derechos del usuario */}
          <section>
            <h2 className="text-base font-bold text-slate-100 mb-2">
              5. Derechos del usuario
            </h2>
            <p className="text-sm leading-relaxed text-slate-300 mb-2">
              Según la normativa aplicable (por ejemplo, GDPR en la UE o CCPA en California),
              puedes tener derecho a acceder, rectificar, limitar el tratamiento o solicitar
              el <strong>borrado de tus datos</strong>. Para ejercer estos derechos:
            </p>
            <ul className="list-disc pl-5 text-sm leading-relaxed text-slate-300 space-y-1">
              <li>Envía una solicitud al contacto indicado más abajo, indicando qué derecho deseas ejercer.</li>
              <li>Podemos pedirte que te identifiques para evitar accesos no autorizados a tus datos.</li>
              <li>Responderemos en el plazo legal aplicable.</li>
            </ul>
          </section>

          {/* Contacto */}
          <section>
            <h2 className="text-base font-bold text-slate-100 mb-2">
              6. Contacto
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              Para preguntas sobre esta política, ejercicio de derechos o reclamaciones:
            </p>
            <p className="text-sm leading-relaxed text-slate-300 mt-2">
              <strong>Responsable / App:</strong> [ELIO Weather & Routes]
              <br />
              <strong>Email:</strong>{' '}
              <a
                href="mailto:jorgeguerreroz@gmail.com"
                className="text-primary-light underline hover:text-primary"
              >
                jorgeguerreroz@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border-default/50">
          <Button
            variant="secondary"
            size="lg"
            onClick={handleBackHome}
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft size={20} aria-hidden />
            Volver al Inicio
          </Button>
        </div>
      </main>
    </div>
  );
}

export default PrivacyView;
