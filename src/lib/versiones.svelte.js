// Las versiones incluidas en biblias.db, reactivas. En la web la base tarda en bajar (unos 67 MB la primera
// vez) y la app ya se usa con la NTV mientras tanto: cuando llegan, los selectores se actualizan solos.
export const versionesLocales = $state({ lista: [], cargadas: false });
