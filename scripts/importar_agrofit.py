"""
Prepara os dados do Agrofit (MAPA) para o Supabase.

Entrada: scripts/dados/agrofitprodutosformulados.csv (UTF-8, separador ";")
Saída:   scripts/saida/agrofit_pragas.csv e scripts/saida/agrofit_produtos.csv
         (importar pelo painel do Supabase: Table Editor > tabela > Insert > Import data from CSV)

Uso: python scripts/importar_agrofit.py
"""

import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------
# CONFIGURAÇÃO
# ---------------------------------------------------------------------

# Culturas da demo: nome exibido -> valores da coluna CULTURA que entram nela
CULTURAS_DEMO = {
    "Tomate": ["Tomate", "Tomate Industrial", "Tomate envarado", "Tomate Rasteiro Industrial"],
    "Café": ["Café"],
    "Alface": ["Alface"],
}

# Produtos registrados para "Todas as culturas" entram só se a praga já existir na cultura
CULTURA_GERAL = "Todas as culturas"

# Plantas daninhas (alvos só de herbicida/regulador) não fazem parte do "foto de praga"
INCLUIR_PLANTAS_DANINHAS = False
CLASSES_NAO_PRAGA = {"herbicida", "regulador de crescimento"}

PASTA = Path(__file__).parent
ENTRADA = PASTA / "dados" / "agrofitprodutosformulados.csv"
SAIDA = PASTA / "saida"

# Só as colunas necessárias (as de empresa/titular ocupam a maior parte do arquivo)
COLUNAS = [
    "NR_REGISTRO", "MARCA_COMERCIAL", "INGREDIENTE_ATIVO", "CLASSE", "CULTURA",
    "PRAGA_NOME_CIENTIFICO", "PRAGA_NOME_COMUM", "CLASSE_TOXICOLOGICA", "ORGANICOS",
]


# ---------------------------------------------------------------------
# FUNÇÕES DE LIMPEZA
# ---------------------------------------------------------------------

def corrigir_c1(caractere: re.Match) -> str:
    """O CSV traz caracteres de controle (ex.: \\x96) que na verdade são do Windows-1252 (–)."""
    return bytes([ord(caractere.group())]).decode("cp1252", errors="ignore")


def limpar(texto: str) -> str:
    """Corrige caracteres quebrados e remove espaços nas pontas e repetidos no meio."""
    texto = re.sub(r"[\x80-\x9f]", corrigir_c1, texto)
    return re.sub(r"\s+", " ", texto).strip()


def para_busca(texto: str) -> str:
    """Minúsculas e sem acento, para comparar textos."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return limpar(sem_acento).lower()


def nomes_comuns(texto: str) -> list[str]:
    """Separa 'Pulgão-verde;  Pulgão-verde-claro' em lista e tira notas como '(1)'."""
    nomes = [re.sub(r"\(\d+\)", "", n) for n in texto.split(";")]
    return [limpar(n) for n in nomes if limpar(n)]


def juntar_nomes(series: pd.Series) -> str:
    """Junta os nomes comuns de várias linhas sem repetir (ignorando maiúsculas/acentos)."""
    vistos, saida = set(), []
    for texto in series:
        for nome in nomes_comuns(texto):
            chave = para_busca(nome)
            if chave not in vistos:
                vistos.add(chave)
                saida.append(nome)
    return "; ".join(saida)


def eh_planta_daninha(classe: str) -> bool:
    """True se a classe do produto for só herbicida e/ou regulador de crescimento."""
    partes = {p.strip().lower() for p in classe.split("/") if p.strip()}
    return bool(partes) and partes <= CLASSES_NAO_PRAGA


def eh_biologico(classe: str, ingrediente: str) -> bool:
    """Biológico pela classe (biológico/microbiológico) ou pelo ingrediente ativo."""
    return bool(re.search(r"biol[oó]gic", classe, re.I)) or "Produto Microbiológico" in ingrediente


# ---------------------------------------------------------------------
# PROCESSAMENTO
# ---------------------------------------------------------------------

def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"Lendo {ENTRADA.name}...")
    df = pd.read_csv(ENTRADA, sep=";", encoding="utf-8", dtype=str,
                     keep_default_na=False, usecols=COLUNAS)
    print(f"  {len(df)} linhas no arquivo original")

    for col in COLUNAS:
        df[col] = df[col].map(limpar)

    # Descarta linhas sem praga (quase todas de reguladores de crescimento)
    df = df[df["PRAGA_NOME_CIENTIFICO"] != ""]

    if not INCLUIR_PLANTAS_DANINHAS:
        df = df[~df["CLASSE"].map(eh_planta_daninha)]

    # Mapeia as variantes (ex.: "Tomate envarado") para o nome da demo
    variante_para_demo = {v: demo for demo, variantes in CULTURAS_DEMO.items() for v in variantes}
    especificas = df[df["CULTURA"].isin(variante_para_demo)].copy()
    especificas["cultura"] = especificas["CULTURA"].map(variante_para_demo)

    # --- agrofit_pragas: uma linha por (cultura, praga científica) ---
    pragas = (
        especificas.groupby(["cultura", "PRAGA_NOME_CIENTIFICO"], as_index=False)
        .agg(praga_nome_comum=("PRAGA_NOME_COMUM", juntar_nomes))
        .rename(columns={"PRAGA_NOME_CIENTIFICO": "praga_nome_cientifico"})
    )
    pragas["cultura_busca"] = pragas["cultura"].map(para_busca)
    pragas["praga_busca"] = (
        pragas["praga_nome_cientifico"] + " " + pragas["praga_nome_comum"]
    ).map(para_busca)

    # --- agrofit_produtos: inclui "Todas as culturas" só para pragas que existem na cultura ---
    gerais = df[df["CULTURA"] == CULTURA_GERAL]
    expandidas = [
        gerais.assign(cultura=cultura).merge(
            pragas.loc[pragas["cultura"] == cultura, ["praga_nome_cientifico"]],
            left_on="PRAGA_NOME_CIENTIFICO", right_on="praga_nome_cientifico",
        ).drop(columns="praga_nome_cientifico")
        for cultura in CULTURAS_DEMO
    ]
    produtos = pd.concat([especificas, *expandidas], ignore_index=True)

    produtos = pd.DataFrame({
        "nr_registro": produtos["NR_REGISTRO"],
        "cultura": produtos["cultura"],
        "cultura_busca": produtos["cultura"].map(para_busca),
        "praga_nome_cientifico": produtos["PRAGA_NOME_CIENTIFICO"],
        "marca_comercial": produtos["MARCA_COMERCIAL"],
        "ingrediente_ativo": produtos["INGREDIENTE_ATIVO"],
        "classe": produtos["CLASSE"],
        "classe_toxicologica": produtos["CLASSE_TOXICOLOGICA"],
        # "OUTROS" não tem significado documentado: tratamos como não orgânico
        "organico": produtos["ORGANICOS"] == "SIM",
        "biologico": [eh_biologico(c, i) for c, i in
                      zip(produtos["CLASSE"], produtos["INGREDIENTE_ATIVO"])],
    }).drop_duplicates(subset=["nr_registro", "cultura", "praga_nome_cientifico"])

    # --- grava os CSVs (sem coluna id: o banco gera) ---
    SAIDA.mkdir(exist_ok=True)
    pragas = pragas[["cultura", "cultura_busca", "praga_nome_comum",
                     "praga_nome_cientifico", "praga_busca"]]
    pragas.to_csv(SAIDA / "agrofit_pragas.csv", index=False, encoding="utf-8")
    produtos.to_csv(SAIDA / "agrofit_produtos.csv", index=False, encoding="utf-8")

    # --- resumo por cultura ---
    resumo = pd.DataFrame({
        "pragas": pragas.groupby("cultura").size(),
        "produtos (linhas)": produtos.groupby("cultura").size(),
        "marcas distintas": produtos.groupby("cultura")["nr_registro"].nunique(),
        "orgânicos": produtos[produtos["organico"]].groupby("cultura")["nr_registro"].nunique(),
        "biológicos": produtos[produtos["biologico"]].groupby("cultura")["nr_registro"].nunique(),
    }).fillna(0).astype(int)
    print("\nResumo por cultura:")
    print(resumo.to_string())
    print(f"\nArquivos gerados em {SAIDA}")


if __name__ == "__main__":
    main()
