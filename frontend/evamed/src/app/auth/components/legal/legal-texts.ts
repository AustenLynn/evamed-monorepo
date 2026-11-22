/**
 * Draft legal texts (audit A-23, 2026-11-22). Written from what EVAmed actually
 * collects; NOT reviewed by a lawyer. The owner chose drafts for review: replace the
 * bracketed placeholders and remove `borrador` once approved.
 */
export interface LegalSection {
  titulo: string;
  parrafos: string[];
}

export interface LegalText {
  titulo: string;
  borrador: boolean;
  actualizado: string;
  secciones: LegalSection[];
}

export const AVISO_PRIVACIDAD: LegalText = {
  titulo: 'Aviso de privacidad',
  borrador: true,
  actualizado: '22 de noviembre de 2026',
  secciones: [
    {
      titulo: 'Responsable',
      parrafos: [
        'EVAMED es una herramienta de la Universidad Iberoamericana Ciudad de México [razón social y domicilio por confirmar], responsable del tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).',
      ],
    },
    {
      titulo: 'Datos que recabamos',
      parrafos: [
        'Al registrarte: nombre completo, correo electrónico, institución o empresa, sector y país. Si entras con Google o Facebook, recibimos además el nombre y el correo de esa cuenta.',
        'Al usar la herramienta: los proyectos que creas (nombre, uso, ubicación, superficies, niveles, vida útil) y sus datos de materiales, construcción, uso y fin de vida.',
        'No recabamos datos personales sensibles.',
      ],
    },
    {
      titulo: 'Para qué los usamos',
      parrafos: [
        'Finalidades necesarias: crear y proteger tu cuenta, guardar tus proyectos y calcular sus resultados, y responder tus solicitudes.',
        'Finalidades secundarias, solo si marcaste la casilla correspondiente al registrarte: enviarte información de EVAMED y avisos de actualizaciones. Puedes retirar este consentimiento en cualquier momento escribiendo a evamed@ibero.mx.',
        '[Por confirmar: uso de datos agregados y anónimos con fines de investigación.]',
      ],
    },
    {
      titulo: 'Con quién los compartimos',
      parrafos: [
        'Con proveedores que nos prestan servicios y los tratan solo por nuestra cuenta: Google Firebase (inicio de sesión) y Amazon Web Services (alojamiento). No vendemos ni cedemos tus datos a terceros. [Por confirmar: transferencias adicionales.]',
      ],
    },
    {
      titulo: 'Tus derechos (ARCO)',
      parrafos: [
        'Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su tratamiento, así como revocar tu consentimiento, escribiendo a evamed@ibero.mx con tu nombre, el correo de tu cuenta y lo que solicitas. Responderemos en un plazo máximo de 20 días hábiles. [Por confirmar: procedimiento y área responsable.]',
      ],
    },
    {
      titulo: 'Cambios a este aviso',
      parrafos: ['Publicaremos cualquier cambio en esta página, con su fecha de actualización.'],
    },
  ],
};

export const TERMINOS: LegalText = {
  titulo: 'Términos y condiciones',
  borrador: true,
  actualizado: '22 de noviembre de 2026',
  secciones: [
    {
      titulo: 'Uso de EVAMED',
      parrafos: [
        'EVAMED es una herramienta de acceso libre, previo registro, para estimar el impacto ambiental de edificios con enfoque de ciclo de vida. Al crear una cuenta aceptas estos términos y el aviso de privacidad.',
        'Eres responsable de la veracidad de los datos que capturas y de mantener la confidencialidad de tu contraseña.',
      ],
    },
    {
      titulo: 'Alcance de los resultados',
      parrafos: [
        'Los resultados son estimaciones basadas en la información que capturas y en bases de datos de terceros (ecoinvent, ECO Platform y otras). Sirven como apoyo para la toma de decisiones y no sustituyen un análisis de ciclo de vida verificado ni una declaración ambiental de producto.',
        'Los datos de las bases de terceros están sujetos a sus propias licencias. [Por confirmar: condiciones de la licencia de ecoinvent para usuarios finales.]',
      ],
    },
    {
      titulo: 'Tus proyectos',
      parrafos: [
        'Los proyectos que creas son tuyos; solo tú puedes verlos y modificarlos. Puedes eliminarlos en cualquier momento.',
      ],
    },
    {
      titulo: 'Responsabilidad',
      parrafos: [
        '[Por confirmar con el área jurídica: limitación de responsabilidad, disponibilidad del servicio, ley aplicable y jurisdicción.]',
      ],
    },
    {
      titulo: 'Contacto',
      parrafos: ['evamed@ibero.mx'],
    },
  ],
};
