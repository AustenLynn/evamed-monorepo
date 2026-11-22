import { HttpErrorResponse } from '@angular/common/http';
import { mensajeErrorProyecto, payloadProyecto, validarProyecto } from './project-form';

const valido = {
  nombre: ' Casa Norte ', usoSeleccionado: 1, paisSeleccionado: 1, vidaUtilSeleccionado: 1,
  superficieConstruida: '120', superficieHabitable: '100', noNiveles: '2',
};

describe('new project form', () => {
  it('accepts a complete project', () => {
    expect(validarProyecto(valido)).toEqual({});
  });

  it('requires a name, use, country and useful life', () => {
    expect(Object.keys(validarProyecto({ ...valido, nombre: '  ', usoSeleccionado: null, paisSeleccionado: undefined, vidaUtilSeleccionado: null })))
      .toEqual(['nombre', 'usoSeleccionado', 'paisSeleccionado', 'vidaUtilSeleccionado']);
  });

  it('rejects impossible or fractional sizes (audit A-07)', () => {
    expect(validarProyecto({ ...valido, superficieConstruida: '0' }).superficieConstruida).toBe('Escribe un número entero mayor que 0.');
    expect(validarProyecto({ ...valido, superficieConstruida: '120.75' }).superficieConstruida).toBe('Escribe un número entero mayor que 0.');
    expect(validarProyecto({ ...valido, noNiveles: '' }).noNiveles).toBe('Escribe un número entero mayor que 0.');
    expect(validarProyecto({ ...valido, superficieHabitable: '500' }).superficieHabitable)
      .toBe('No puede ser mayor que la superficie construida.');
  });

  it('builds the request with whole numbers and a trimmed name', () => {
    expect(payloadProyecto({ ...valido, tipoSeleccionado: undefined }, 7)).toMatchObject({
      name_project: 'Casa Norte', builded_surface: 120, living_area: 100, tier: 2, use_id: 1,
      type_id: null, user_platform_id: 7, distance: null,
    });
  });

  it('explains why the server refused (audit A-05)', () => {
    expect(mensajeErrorProyecto(new HttpErrorResponse({ status: 403 }))).toBe('Verifica tu correo electrónico para crear proyectos.');
    expect(mensajeErrorProyecto(new HttpErrorResponse({ status: 400, error: { living_area: ['No puede ser mayor.'] } })))
      .toBe('No puede ser mayor.');
    expect(mensajeErrorProyecto(new HttpErrorResponse({ status: 0 }))).toBe('No se pudo guardar el proyecto. Revisa tu conexión e inténtalo de nuevo.');
  });
});
