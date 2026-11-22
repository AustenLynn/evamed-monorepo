import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AVISO_PRIVACIDAD, LegalText, TERMINOS } from './legal-texts';

/** Public privacy notice and terms pages, reachable without signing in (audit A-23). */
@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="legal">
      <a routerLink="/auth/login" class="legal__back">← Volver</a>
      <h1>{{ texto.titulo }}</h1>
      @if (texto.borrador) {
        <p class="legal__borrador" role="note">Borrador pendiente de revisión jurídica. Los textos entre corchetes están por confirmar.</p>
      }
      <p class="legal__fecha">Última actualización: {{ texto.actualizado }}</p>
      @for (seccion of texto.secciones; track seccion.titulo) {
        <section>
          <h2>{{ seccion.titulo }}</h2>
          @for (parrafo of seccion.parrafos; track $index) {
            <p>{{ parrafo }}</p>
          }
        </section>
      }
    </main>
  `,
  styles: [`
    .legal { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; line-height: 1.6; color: #333; }
    .legal h1 { font-size: 1.8rem; margin: 16px 0 8px; }
    .legal h2 { font-size: 1.15rem; margin: 24px 0 8px; }
    .legal__borrador { background: #fff4d6; border-left: 4px solid #e0a800; padding: 8px 12px; }
    .legal__fecha { color: #666; font-size: 0.9rem; }
    .legal__back { color: inherit; }
  `],
})
export class LegalPageComponent {
  readonly texto: LegalText = inject(ActivatedRoute).snapshot.data['documento'] === 'terminos' ? TERMINOS : AVISO_PRIVACIDAD;
}
