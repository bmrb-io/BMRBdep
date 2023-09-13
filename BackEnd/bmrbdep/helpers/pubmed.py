#!/usr/bin/python3

import logging
import xml.etree.ElementTree as ElementTree

import pynmrstar
import requests
from unidecode import unidecode


def _safe_unidecode(item):
    if item is None:
        return None
    return unidecode(item)


def _get_tag_value(tag_name, root=None):

    res = list(root.iter(tag_name))
    if len(res) == 1:
        return res[0].text
    elif len(res) > 1:
        raise ValueError("Too many results for tag: %s" % tag_name)
    else:
        return "."


def update_citation_with_pubmed(citation_saveframe: pynmrstar.Saveframe,
                                schema: pynmrstar.Schema = None):
    """ Modifies the citation saveframe passed in to add in information loaded from PubMed. """

    pubmed_id = citation_saveframe.get_tag('PubMed_ID')[0]

    if not pubmed_id or pubmed_id == ".":
        return

    # Get whatever schema will be used for these actions
    schema = pynmrstar.utils.get_schema(schema)

    # Get the XML
    req = requests.get("https://www.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=%s"
                       "&retmode=xml&tool=bmrbcitationparser&email=help@bmrb.io" % pubmed_id)

    try:
        root = ElementTree.fromstring(req.text)
    except ElementTree.ParseError:
        logging.exception('Could not get the information for the PubMed ID!')
        citation_saveframe.add_tag('Note_to_annotator', "API Error: %s" % req.text)
        return
    for error in root.iter('ERROR'):
        if 'ID list is empty' in error.text:
            logging.warning("Invalid or not yet released PubMed ID. Cannot update citation saveframe.")
            citation_saveframe.add_tag('Note_to_annotator', 'Invalid or not yet released PubMed ID')
        else:
            logging.exception('PubMed API threw exception: %s' % error.text)
            citation_saveframe.add_tag('Note_to_annotator', "API Error: %s" % error.text)
        return

    # We will fill a new loop with the author info
    author_loop = pynmrstar.Loop.from_scratch()
    author_loop.add_tag(['_Citation_author.Ordinal',
                         '_Citation_author.Given_name',
                         '_Citation_author.Family_name',
                         '_Citation_author.First_initial',
                         '_Citation_author.Middle_initials',
                         '_Citation_author.Family_title'])

    citation_saveframe["Status"] = "published"
    citation_saveframe["Type"] = "journal"
    if '_Citation_author' in citation_saveframe:
        citation_saveframe['_Citation_author'] = author_loop
    else:
        citation_saveframe.add_loop(author_loop)

    try:
        # Figure out the authors
        for author in root.iter('Author'):
            author_dict = {'first': ".", 'last': "."}
            for child in author:
                if child.tag == "LastName":
                    author_dict['last'] = _safe_unidecode(child.text)
                if child.tag == "ForeName":
                    portions = child.text.split()
                    author_dict['first'] = portions[0]
                    if len(portions) > 1:
                        for x in range(1, len(portions)):
                            if len(portions[x]) > 1:
                                author_dict['first'] = author_dict['first'] + " %s" % portions[x]
                            else:
                                break
                    author_dict['first'] = _safe_unidecode(author_dict['first'])
                if child.tag == "Initials":
                    if len(child.text) == 1:
                        author_dict['first_initial'] = _safe_unidecode(child.text + ".")
                    if len(child.text) == 2:
                        author_dict['first_initial'] = _safe_unidecode(child.text[0] + ".")
                        author_dict['middle_initial'] = _safe_unidecode(child.text[1] + ".")
                if child.tag == "Suffix":
                    author_dict['family_title'] = _safe_unidecode(child.text)

            author_loop.add_data([0, author_dict['first'], author_dict['last'], author_dict.get('first_initial', "."),
                                  author_dict.get('middle_initial', "."), author_dict.get('family_title', ".")])

        # Renumber the authors and add the other tags
        author_loop.renumber_rows('_Citation_author.Ordinal')
        author_loop.add_missing_tags(schema=schema)

        # Set some simple tags
        citation_saveframe.add_tag('Title', _get_tag_value('ArticleTitle', root=root), update=True)
        citation_saveframe.add_tag('Journal_abbrev', _get_tag_value('ISOAbbreviation', root=root), update=True)
        citation_saveframe.add_tag('Journal_name_full', _get_tag_value('Title', root=root), update=True)
        citation_saveframe.add_tag('Journal_volume', _get_tag_value('Volume', root=root), update=True)
        citation_saveframe.add_tag('Journal_issue', _get_tag_value('Issue', root=root), update=True)
        citation_saveframe.add_tag('Journal_ISSN', _get_tag_value('ISSN', root=root), update=True)

        # DOI requires a bit of checking
        for article_id in root.iter('ArticleId'):
            if article_id.attrib.get('IdType', None) == "doi":
                citation_saveframe.add_tag('DOI', article_id.text, update=True)
                break

        # Might need to check MedlineDate for the next field as well
        try:
            year = _get_tag_value('Year', root=next(root.iter('PubDate')))
        except (ValueError, ElementTree.ParseError, StopIteration):
            logging.warning("Had to fallback to MedlineDate as Year not available in PubMed XML.")
            year = _get_tag_value('MedlineDate', root=root).split()[0]
        citation_saveframe.add_tag('Year', year, update=True)

        # Get the pages (remove spaces first, then split on -)
        pgn = _get_tag_value('MedlinePgn', root=root)
        first_page, last_page = ".", "."

        if pgn is not None:
            page_chunks = "".join(pgn.split()).split("-")
            # Only one page
            if len(page_chunks) == 1:
                first_page, last_page = page_chunks[0], page_chunks[0]
            # A range of pages
            elif len(page_chunks) == 2:
                first_page, last_page = page_chunks[0], page_chunks[1]

                # If the page range is something like 11939-44
                if len(first_page) != len(last_page):
                    last_page = first_page[0:len(first_page) - len(last_page)] + last_page
            # Something weird
            else:
                first_page, last_page = pgn, pgn

        citation_saveframe.add_tag('Page_first', first_page, update=True)
        citation_saveframe.add_tag('Page_last', last_page, update=True)

    except ValueError as e:
        logging.exception('Something went wrong when generating citation from PubMed data: %s' % e)

    # Do character validation
    for tag in citation_saveframe.tag_iterator():
        citation_saveframe.add_tag(tag[0], _safe_unidecode(tag[1]), update=True)

    citation_saveframe.add_missing_tags(schema=schema)
