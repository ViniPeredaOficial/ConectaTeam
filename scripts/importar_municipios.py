"""
Prepara os municípios de SP (código IBGE, nome, UF, lat, lon) para a tabela municipios.

Fonte: https://github.com/kelvins/municipios-brasileiros (licença MIT),
       compilado a partir de dados do IBGE.
Saída: scripts/saida/municipios.csv
       (importar pelo painel do Supabase: Table Editor > municipios > Insert > Import data from CSV)

Uso: python scripts/importar_municipios.py
"""

import sys
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------
# CONFIGURAÇÃO
# ---------------------------------------------------------------------

URL_FONTE = "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv"
CODIGO_UF = 35   # 35 = São Paulo (código IBGE da UF)
SIGLA_UF = "SP"

PASTA = Path(__file__).parent
CACHE = PASTA / "dados" / "municipios_brasil.csv"
SAIDA = PASTA / "saida"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    # Usa a cópia local se já existir; senão baixa da fonte
    if not CACHE.exists():
        print(f"Baixando {URL_FONTE}...")
        CACHE.parent.mkdir(exist_ok=True)
        pd.read_csv(URL_FONTE).to_csv(CACHE, index=False)

    df = pd.read_csv(CACHE)
    df = df[df["codigo_uf"] == CODIGO_UF]

    municipios = pd.DataFrame({
        "cod_ibge": df["codigo_ibge"].astype(int),
        "nome": df["nome"].str.strip(),
        "uf": SIGLA_UF,
        "lat": df["latitude"],
        "lon": df["longitude"],
    }).sort_values("nome")

    SAIDA.mkdir(exist_ok=True)
    municipios.to_csv(SAIDA / "municipios.csv", index=False, encoding="utf-8")
    print(f"{len(municipios)} municípios de {SIGLA_UF} gravados em {SAIDA / 'municipios.csv'}")


if __name__ == "__main__":
    main()
